# assemble.py src out: replace /*SHARED_A*/ and /*SHARED_TF*/ with the blocks taken from s01 / s02
import sys
SH = '/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/'
src, out = sys.argv[1], sys.argv[2]
s = open(src).read()
a = open(SH + 'shared-a.txt').read().rstrip('\n')
tf = open(SH + 'shared-tf.txt').read().rstrip('\n')
s = s.replace('/*SHARED_A*/', a).replace('/*SHARED_TF*/', tf)
open(out, 'w').write(s)
