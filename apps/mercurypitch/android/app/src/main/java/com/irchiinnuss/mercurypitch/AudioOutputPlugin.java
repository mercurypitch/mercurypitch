package com.irchiinnuss.mercurypitch;

import android.content.Context;
import android.database.ContentObserver;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The phone's sound output, as the page reads it: the volume of the stream the
// page plays on, where the sound goes and the audio mode. Read on demand
// (read) and sent again on every change (audioOutputChange): a volume key, a
// headset or Bluetooth device coming or going. A device coming or going goes
// out under audioRouteChange as well, for a page that follows the route for
// as long as the app runs: the latency offset. The premium rooms show a hint
// while the volume is down; a test build's Developer screen shows all of it,
// for the moment a room's sound goes quiet on a phone.
//
// Which stream is the page's. A web page's sound is media, so it is
// STREAM_MUSIC, unless the phone is in a call-style mode (a call, or an app
// holding MODE_IN_COMMUNICATION), where what plays follows the voice call
// volume instead. Both are reported, and the one that applies is named.
//
// Android has no public broadcast for a volume change, but each stream's
// volume is a system setting, so an observer on the settings hears every
// press of the volume keys (a moment late: the system writes it after a
// short delay). It does not hear a stream muted or unmuted with its level
// left where it was: the system writes the level only, and a muted stream
// reads as 0. The page reads again while it needs to know
// (RoomVolumeHint.tsx).
//
// Where the sound goes is read off the devices connected, in the order
// media prefers them: Bluetooth or a hearing aid, then a USB or wired
// headset, then USB audio or HDMI, then the speaker; in a call-style mode,
// the communication device (Android 12 on).
//
// Read only: nothing here changes the volume, the mode or the route.
//
// apps/mercurypitch/src/android-audio-output.test.ts pins the wiring: the
// registration in MainActivity and the names the JavaScript side uses.
@CapacitorPlugin(name = "AudioOutput")
public class AudioOutputPlugin extends Plugin {

    /** What every change is sent to JavaScript as. */
    static final String EVENT_CHANGE = "audioOutputChange";

    /** A change of route, sent again on its own: what follows the route listens for as long as the app runs. */
    static final String EVENT_ROUTE = "audioRouteChange";

    private final Handler main = new Handler(Looper.getMainLooper());
    private AudioManager audio;
    private ContentObserver volumeWatch;
    private AudioDeviceCallback routeWatch;

    @Override
    public void load() {
        audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) {
            return;
        }
        volumeWatch = new ContentObserver(main) {
            @Override
            public void onChange(boolean selfChange) {
                changed("volume");
            }
        };
        getContext().getContentResolver().registerContentObserver(Settings.System.CONTENT_URI, true, volumeWatch);
        routeWatch = new AudioDeviceCallback() {
            @Override
            public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                changed("route");
            }

            @Override
            public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                changed("route");
            }
        };
        audio.registerAudioDeviceCallback(routeWatch, main);
    }

    @Override
    protected void handleOnDestroy() {
        if (volumeWatch != null) {
            getContext().getContentResolver().unregisterContentObserver(volumeWatch);
        }
        if (audio != null && routeWatch != null) {
            audio.unregisterAudioDeviceCallback(routeWatch);
        }
    }

    @PluginMethod
    public void read(PluginCall call) {
        call.resolve(snapshot());
    }

    /** The output as it is now, with what moved it. */
    private void changed(String reason) {
        JSObject data = snapshot();
        data.put("reason", reason);
        notifyListeners(EVENT_CHANGE, data);
        if ("route".equals(reason)) {
            notifyListeners(EVENT_ROUTE, data);
        }
    }

    private JSObject snapshot() {
        JSObject data = new JSObject();
        if (audio == null) {
            return data;
        }
        int mode = audio.getMode();
        boolean callMode = mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION;
        int stream = callMode ? AudioManager.STREAM_VOICE_CALL : AudioManager.STREAM_MUSIC;
        int steps = audio.getStreamMaxVolume(stream);
        int step = audio.getStreamVolume(stream);
        data.put("outputVolume", steps > 0 ? (double) step / steps : 0.0);
        data.put("volumeStep", step);
        data.put("volumeSteps", steps);
        data.put("volumeMin", audio.getStreamMinVolume(stream));
        data.put("stream", callMode ? "voice call" : "music");
        data.put("streamMuted", audio.isStreamMute(stream));
        data.put("musicVolume", fraction(AudioManager.STREAM_MUSIC));
        data.put("callVolume", fraction(AudioManager.STREAM_VOICE_CALL));
        data.put("mode", modeName(mode));
        data.put("musicActive", audio.isMusicActive());
        JSArray outputs = new JSArray();
        AudioDeviceInfo device = callMode ? communicationDevice() : null;
        if (device == null) {
            device = mediaDevice();
        }
        if (device != null) {
            JSObject port = new JSObject();
            port.put("type", typeName(device.getType()));
            port.put("name", String.valueOf(device.getProductName()));
            outputs.put(port);
        }
        data.put("outputs", outputs);
        return data;
    }

    private double fraction(int stream) {
        int steps = audio.getStreamMaxVolume(stream);
        return steps > 0 ? (double) audio.getStreamVolume(stream) / steps : 0.0;
    }

    private AudioDeviceInfo communicationDevice() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return audio.getCommunicationDevice();
        }
        return null;
    }

    /** The output media plays on: of the kinds that take it from the speaker, the first in rank. */
    private AudioDeviceInfo mediaDevice() {
        AudioDeviceInfo best = null;
        int bestRank = -1;
        for (AudioDeviceInfo device : audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            int rank = mediaRank(device.getType());
            if (rank >= bestRank) {
                best = device;
                bestRank = rank;
            }
        }
        return best;
    }

    private static int mediaRank(int type) {
        switch (type) {
            case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
            case AudioDeviceInfo.TYPE_BLE_HEADSET:
            case AudioDeviceInfo.TYPE_BLE_SPEAKER:
            case AudioDeviceInfo.TYPE_HEARING_AID:
                return 4;
            case AudioDeviceInfo.TYPE_USB_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
                return 3;
            case AudioDeviceInfo.TYPE_USB_DEVICE:
            case AudioDeviceInfo.TYPE_HDMI:
                return 2;
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:
                return 1;
            default:
                return -2;
        }
    }

    private static String typeName(int type) {
        switch (type) {
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:
                return "builtin-speaker";
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE:
                return "builtin-earpiece";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
                return "wired-headset";
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
                return "wired-headphones";
            case AudioDeviceInfo.TYPE_USB_HEADSET:
                return "usb-headset";
            case AudioDeviceInfo.TYPE_USB_DEVICE:
                return "usb-device";
            case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
                return "bluetooth-a2dp";
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
                return "bluetooth-sco";
            case AudioDeviceInfo.TYPE_BLE_HEADSET:
                return "ble-headset";
            case AudioDeviceInfo.TYPE_BLE_SPEAKER:
                return "ble-speaker";
            case AudioDeviceInfo.TYPE_HEARING_AID:
                return "hearing-aid";
            case AudioDeviceInfo.TYPE_HDMI:
                return "hdmi";
            default:
                return "type-" + type;
        }
    }

    private static String modeName(int mode) {
        switch (mode) {
            case AudioManager.MODE_NORMAL:
                return "normal";
            case AudioManager.MODE_RINGTONE:
                return "ringtone";
            case AudioManager.MODE_IN_CALL:
                return "in call";
            case AudioManager.MODE_IN_COMMUNICATION:
                return "in communication";
            default:
                return "mode " + mode;
        }
    }
}
