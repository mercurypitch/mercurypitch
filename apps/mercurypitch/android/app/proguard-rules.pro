# R8 rules for the release build (app/build.gradle).
#
# Most of what has to survive R8 already says so itself: @capacitor/android
# keeps every plugin and its @PluginMethod methods, the social login plugin
# keeps Capacitor, the Facebook SDK and Google sign-in whole, and RevenueCat
# and OkHttp bring their own rules. What is left is ours.

# The page reaches native through the WebView's JavaScript interface, which
# calls its methods by name.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# The app's own code: MainActivity and the picture-in-picture plugin, whose
# methods the page calls by name. Capacitor's rules cover the plugin today;
# this keeps the next one safe as well.
-keep class com.irchiinnuss.mercurypitch.** { *; }

# Line numbers in Play's crash reports, without the source file names.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
