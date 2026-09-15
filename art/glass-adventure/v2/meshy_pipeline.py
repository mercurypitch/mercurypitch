"""Use the existing authenticated Meshy MCP launcher with an explicit credit ledger.

No credential is read, printed, stored or changed. The existing pass-cli launcher
injects its API key only into the MCP child. Submissions are never auto-retried.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import time
from urllib.parse import urlsplit, urlunsplit

HERE=Path(__file__).resolve().parent
LEDGER=HERE/'meshy-ledger.json'
LAUNCHER=Path.home()/'.dotfiles/personal/scripts/mcp/meshy-mcp.sh'
CEILING=600


class MCP:
    def __enter__(self):
        self.proc=subprocess.Popen([str(LAUNCHER)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,bufsize=0)
        self.selector=selectors.DefaultSelector();self.selector.register(self.proc.stdout,selectors.EVENT_READ,'out');self.selector.register(self.proc.stderr,selectors.EVENT_READ,'err')
        self.pending=b'';self.errors=b'';self.next_id=0
        try:
            self.request('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'glass-museum-art','version':'2.0'}})
            self.proc.stdin.write((json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n').encode());self.proc.stdin.flush()
        except BaseException:
            self.__exit__(None,None,None);raise
        return self
    def __exit__(self,*args):
        if self.proc.poll() is None:
            os.killpg(self.proc.pid,signal.SIGTERM)
            try:self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:os.killpg(self.proc.pid,signal.SIGKILL);self.proc.wait(timeout=5)
        self.selector.close()
    def request(self,method,params,deadline=65):
        self.next_id+=1;rid=self.next_id
        self.proc.stdin.write((json.dumps({'jsonrpc':'2.0','id':rid,'method':method,'params':params})+'\n').encode());self.proc.stdin.flush();end=time.monotonic()+deadline
        while time.monotonic()<end:
            for key,_ in self.selector.select(timeout=1):
                data=os.read(key.fileobj.fileno(),65536)
                if not data:
                    self.selector.unregister(key.fileobj)
                    continue
                if key.data=='err':
                    self.errors=(self.errors+data)[-16000:]
                    continue
                self.pending+=data
                while b'\n' in self.pending:
                    line,self.pending=self.pending.split(b'\n',1)
                    try:response=json.loads(line)
                    except ValueError:continue
                    if response.get('id')==rid:
                        if 'error' in response:raise RuntimeError('MCP request rejected: '+str(response['error'].get('message','unknown')))
                        return response['result']
            if self.proc.poll() is not None:
                if b'no session' in self.errors or b'authenticated client' in self.errors:
                    raise RuntimeError('Existing pass-cli session is not authenticated; restore it before Meshy work.')
                raise RuntimeError('Existing Meshy MCP launcher exited; no remote request was confirmed.')
        raise TimeoutError('MCP deadline exceeded; do not retry a charged submission before reconciling the ledger.')
    def tool(self,name,args):
        result=self.request('tools/call',{'name':name,'arguments':args})
        if result.get('isError'):raise RuntimeError('Meshy tool failed: '+str(result.get('content',[{}])[0].get('text','unknown')))
        if result.get('structuredContent') is not None:return result['structuredContent']
        for block in result.get('content',[]):
            if block.get('type')=='text':
                try:return json.loads(block['text'])
                except ValueError:pass
        return result


def redact_signed_urls(value):
    if isinstance(value,dict):return {key:redact_signed_urls(item) for key,item in value.items()}
    if isinstance(value,list):return [redact_signed_urls(item) for item in value]
    if isinstance(value,str) and value.startswith(('https://','http://')):
        parts=urlsplit(value)
        return urlunsplit((parts.scheme,parts.netloc,parts.path,'signed-parameters-omitted' if parts.query else '',parts.fragment))
    return value


def load():
    return json.loads(LEDGER.read_text()) if LEDGER.exists() else {'version':1,'ceilingCredits':CEILING,'jobs':[],'balanceChecks':[]}


def save(ledger):
    temp=LEDGER.with_suffix('.tmp');temp.write_text(json.dumps(ledger,indent=2)+'\n');temp.replace(LEDGER)


def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()


def main():
    p=argparse.ArgumentParser();sub=p.add_subparsers(dest='action',required=True)
    sub.add_parser('balance');sub.add_parser('schemas')
    create=sub.add_parser('submit');create.add_argument('--name',required=True);create.add_argument('--reference',type=Path,required=True);create.add_argument('--textured',action='store_true');create.add_argument('--polygons',type=int,default=18000)
    status=sub.add_parser('status');status.add_argument('--name',required=True)
    download=sub.add_parser('download');download.add_argument('--name',required=True)
    args=p.parse_args();ledger=load()
    with MCP() as client:
        if args.action=='balance':
            result=client.tool('meshy_check_balance',{'response_format':'json'});ledger['balanceChecks'].append({'at':now(),**result});save(ledger);print(json.dumps(result));return
        if args.action=='schemas':
            result=client.request('tools/list',{})
            selected=[t for t in result['tools'] if t['name'] in ['meshy_image_to_3d','meshy_get_task_status','meshy_download_model','meshy_check_balance']]
            (HERE/'meshy-tool-schemas.json').write_text(json.dumps(selected,indent=2)+'\n');print(json.dumps({'tools':[t['name'] for t in selected]}));return
        if args.action=='submit':
            if any(j['name']==args.name for j in ledger['jobs']):raise RuntimeError('Logical job already exists; reconcile it instead of resubmitting.')
            ref=args.reference.resolve()
            if not ref.is_relative_to(HERE/'references') or not ref.is_file():raise ValueError('Reference must be an inspected file in v2/references.')
            if not 100<=args.polygons<=300000:raise ValueError('Unsupported polygon target')
            cost=30 if args.textured else 20
            reserved=sum(j['quotedCredits'] for j in ledger['jobs'] if j['state']!='refunded')
            if reserved+cost>CEILING:raise RuntimeError('First-wave600-credit ceiling would be exceeded')
            balance=client.tool('meshy_check_balance',{'response_format':'json'})['balance']
            if balance<cost:raise RuntimeError('Insufficient balance')
            params={'file_path':str(ref),'ai_model':'latest','model_type':'standard','should_texture':args.textured,'enable_pbr':args.textured,'should_remesh':True,'target_polycount':args.polygons,'topology':'triangle','save_pre_remeshed_model':True,'image_enhancement':False,'remove_lighting':False,'target_formats':['glb'],'multi_view_thumbnails':True,'response_format':'json'}
            job={'name':args.name,'reference':str(ref.relative_to(HERE)),'inputSha256':hashlib.sha256(ref.read_bytes()).hexdigest(),'submittedAt':now(),'quotedCredits':cost,'balanceBefore':balance,'state':'submission-unconfirmed','parameters':{k:v for k,v in params.items() if k!='file_path'}}
            ledger['jobs'].append(job);save(ledger)
            result=client.tool('meshy_image_to_3d',params)
            if not result.get('task_id'):raise RuntimeError('No task ID returned; reconcile submission before doing anything else')
            job.update({'taskId':result['task_id'],'state':'submitted'});save(ledger)
            after=client.tool('meshy_check_balance',{'response_format':'json'})['balance'];job['balanceAfter']=after;job['observedBalanceDelta']=balance-after;save(ledger)
            print(json.dumps({'name':args.name,'taskId':job['taskId'],'quotedCredits':cost,'observedBalanceDelta':balance-after,'balance':after}));return
        job=next((j for j in ledger['jobs'] if j['name']==args.name),None)
        if not job or not job.get('taskId'):raise ValueError('Job has no confirmed task ID')
        if args.action=='status':
            result=client.tool('meshy_get_task_status',{'task_id':job['taskId'],'task_type':'image-to-3d','wait':False,'response_format':'json'})
            # Store provider response locally for provenance without dumping signed URLs.
            target=HERE/'meshy'/args.name;target.mkdir(parents=True,exist_ok=True);(target/'status.json').write_text(json.dumps(redact_signed_urls(result),indent=2)+'\n')
            job['lastStatus']=result.get('status');job['lastCheckedAt']=now();save(ledger)
            print(json.dumps({key:result.get(key) for key in ['task_id','status','progress','error']}));return
        target=HERE/'meshy'/args.name;target.mkdir(parents=True,exist_ok=True)
        result=client.tool('meshy_download_model',{'task_id':job['taskId'],'task_type':'image-to-3d','format':'glb','include_textures':False,'save_to':str(target/'donor.glb')})
        (target/'download.json').write_text(json.dumps(redact_signed_urls(result),indent=2)+'\n')
        raw=(target/'donor.glb').read_bytes();job['download']={'file':str((target/'donor.glb').relative_to(HERE)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()};save(ledger);print(json.dumps(job['download']))

if __name__=='__main__':main()
