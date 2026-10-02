package com.irchiinnuss.mercurypitch;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import android.util.Rational;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The Karaoke room's lyrics in a small window, on Android.
//
// While a song plays the room switches auto-enter on (setAutoEnter), and a
// singer who then leaves the app -- the home gesture, the recents screen --
// keeps the room in a floating window instead of losing it. The page stays
// visible in there, so the lyrics keep moving; the room draws a compact view
// of itself for as long as the window is up (pictureInPictureChange).
//
// Two ways in, by Android version. From Android 12 (API 31) the system enters
// by itself once the activity's params say so, which is also what makes the
// home gesture animate straight into the window. Below that nothing does it
// for us: MainActivity.onUserLeaveHint calls enterOnLeave(), which enters by
// hand while auto-enter is on.
//
// The window's play and pause are the media session's. Android's PiP menu
// shows them for an active session of the same package when the activity
// sets no actions of its own, and the media-session plugin's session is that
// one while a song plays or is paused. So this sets none.
//
// Every path survives a phone without picture-in-picture: no feature, or the
// singer turned it off for this app in the system settings. Then leaving the
// app is what it was before, a song playing in the background.
//
// apps/mercurypitch/src/android-picture-in-picture.test.ts pins the wiring:
// the registration, both forwards from MainActivity, and the manifest flag.
@CapacitorPlugin(name = "PictureInPicture")
public class PictureInPicturePlugin extends Plugin {

    private static final String TAG = "PictureInPicture";

    /** What the room tells JavaScript about the window. */
    static final String EVENT_CHANGE = "pictureInPictureChange";

    // A wide window, as a video's: a line of lyrics is wide. Android allows
    // anything from 1:2.39 to 2.39:1.
    private static final Rational ASPECT_RATIO = new Rational(16, 9);

    private boolean autoEnter = false;

    @PluginMethod
    public void setAutoEnter(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getBridge().executeOnMainThread(() -> {
            autoEnter = enabled;
            applyParams();
            call.resolve();
        });
    }

    /** MainActivity.onUserLeaveHint: enter by hand below Android 12. */
    void enterOnLeave() {
        if (!autoEnter || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S || !supported()) {
            return;
        }
        Activity activity = getActivity();
        try {
            activity.enterPictureInPictureMode(params());
        } catch (RuntimeException error) {
            // Turned off for this app, or refused: the song carries on behind.
            Log.w(TAG, "Could not enter picture-in-picture", error);
        }
    }

    /** MainActivity.onPictureInPictureModeChanged. */
    void modeChanged(boolean inPictureInPicture) {
        JSObject data = new JSObject();
        data.put("inPictureInPicture", inPictureInPicture);
        notifyListeners(EVENT_CHANGE, data);
    }

    private boolean supported() {
        Activity activity = getActivity();
        return activity != null && activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
    }

    private void applyParams() {
        // Below Android 12 the params only matter at the moment of entering,
        // and enterOnLeave builds them then.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || !supported()) {
            return;
        }
        try {
            getActivity().setPictureInPictureParams(params());
        } catch (RuntimeException error) {
            Log.w(TAG, "Could not set picture-in-picture params", error);
        }
    }

    private PictureInPictureParams params() {
        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder().setAspectRatio(ASPECT_RATIO);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Text, not video: a seamless resize would stretch the last
            // frame of the old size, and a crossfade reads better.
            builder.setAutoEnterEnabled(autoEnter).setSeamlessResizeEnabled(false);
        }
        return builder.build();
    }
}
