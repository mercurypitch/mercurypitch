// Read-only native breadcrumbs are exposed only in the existing diagnostic test profile.
import Capacitor

@objc(GameDiagnosticsPlugin)
final class GameDiagnosticsPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "GameDiagnosticsPlugin"
    let jsName = "BesideCueGameDiagnostics"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise)]

    @objc func read(_ call: CAPPluginCall) {
        guard GameDiagnostics.enabled else {
            call.reject("Game diagnostics are disabled")
            return
        }
        call.resolve(GameDiagnostics.store.snapshot())
    }
}
