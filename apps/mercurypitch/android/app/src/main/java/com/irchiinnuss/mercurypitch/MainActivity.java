package com.irchiinnuss.mercurypitch;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

// Google sign-in needs this activity in the social-login plugin's shape, in
// two ways, and the stock BridgeActivity is neither.
//
// The marker. GoogleProvider.login rejects any login that names scopes --
// "You CANNOT use scopes without modifying the main activity" -- unless the
// activity implements ModifiedMainActivityForSocialLoginPlugin, and
// native-sign-in.ts names `email` and `profile` (iOS hands them to GIDSignIn
// as its scopes). Without it every Google press on Android failed before a
// sheet opened, and the panel reported it as `unavailable`.
//
// The consent result. Once Credential Manager has returned the id token, the
// plugin asks Google's AuthorizationClient for those scopes, and when Google
// wants the singer to confirm, it opens that sheet with
// startIntentSenderForResult under request codes of its own. The plugin
// declares none of them to Capacitor, so the Bridge passes the answer to no
// plugin and the login would wait forever. onActivityResult hands it back.
//
// apps/mercurypitch/src/android-main-activity.test.ts pins both: the marker,
// the request-code range below, and the plugin name it is handed to.
//
// And the Karaoke room's lyrics window (PictureInPicturePlugin.java). The
// plugin lives in this app, not in an npm package, so Capacitor does not
// find it by itself: it is registered here, before the bridge starts. The
// activity hears the two moments the plugin needs, leaving the app and the
// window coming and going, and passes both on.
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PictureInPicturePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        PictureInPicturePlugin plugin = pictureInPicture();
        if (plugin != null) {
            plugin.enterOnLeave();
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        PictureInPicturePlugin plugin = pictureInPicture();
        if (plugin != null) {
            plugin.modeChanged(isInPictureInPictureMode);
        }
    }

    private PictureInPicturePlugin pictureInPicture() {
        Bridge bridge = getBridge();
        PluginHandle handle = bridge == null ? null : bridge.getPlugin("PictureInPicture");
        Plugin plugin = handle == null ? null : handle.getInstance();
        return plugin instanceof PictureInPicturePlugin ? (PictureInPicturePlugin) plugin : null;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        // Capacitor's own routing first -- plugins that claim a request code,
        // then Cordova, then AndroidX -- none of which claims Google's.
        super.onActivityResult(requestCode, resultCode, data);

        if (!isGoogleConsent(requestCode)) {
            return;
        }
        Bridge bridge = getBridge();
        PluginHandle handle = bridge == null ? null : bridge.getPlugin("SocialLogin");
        Plugin plugin = handle == null ? null : handle.getInstance();
        if (!(plugin instanceof SocialLoginPlugin)) {
            Log.w(TAG, "A Google consent result arrived with no SocialLogin plugin to take it");
            return;
        }
        ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }

    // Never called: the plugin only checks that the interface is there.
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}

    // The request codes the plugin opens Google's consent sheet under, from
    // MIN up to but not including MAX.
    private static boolean isGoogleConsent(int requestCode) {
        return requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
            && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX;
    }
}
