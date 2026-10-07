// Native game breadcrumbs survive WebContent reloads without relying on JavaScript.
import Foundation

final class GameDiagnosticStore {
    struct Event: Codable {
        let id: String
        let at: Double
        let launchId: String
        let version: String
        let build: String
        let kind: String

        var dictionary: [String: Any] {
            ["id": id, "at": at, "launchId": launchId, "version": version,
             "build": build, "kind": kind]
        }
    }

    private let file: URL?
    private let lock = NSLock()
    private var events: [Event]
    let launchId: String
    let version: String
    let build: String

    init(file: URL?, version: String, build: String, launchId: String = UUID().uuidString) {
        self.file = file
        self.version = version
        self.build = build
        self.launchId = launchId
        if let file = file,
           let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize,
           size <= 65536, let data = try? Data(contentsOf: file),
           let saved = try? JSONDecoder().decode([Event].self, from: data) {
            self.events = Array(saved.suffix(16))
        } else {
            self.events = []
        }
    }

    func record(_ kind: String) {
        guard ["native-launch", "memory-warning", "web-content-terminated"].contains(kind) else { return }
        lock.lock()
        defer { lock.unlock() }
        events.append(Event(id: UUID().uuidString, at: Date().timeIntervalSince1970 * 1000,
                            launchId: launchId, version: version, build: build, kind: kind))
        events = Array(events.suffix(16))
        // The WebContent process is separate. Write before its existing delegate
        // reloads the page; do not ask the dying JS context to save this event.
        if let file = file, let data = try? JSONEncoder().encode(events) {
            do {
                try FileManager.default.createDirectory(at: file.deletingLastPathComponent(),
                                                        withIntermediateDirectories: true)
                try data.write(to: file, options: .atomic)
            } catch {
                NSLog("[Game diagnostics] breadcrumb persistence unavailable")
            }
        }
    }

    func snapshot() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return ["launchId": launchId, "version": version, "build": build,
                "events": events.map { $0.dictionary }]
    }
}

enum GameDiagnostics {
    // Only the generated games testing plist enables this, including Release
    // TestFlight builds. Store archives keep the stock controller and no capture.
    static var enabled: Bool {
        Bundle.main.object(forInfoDictionaryKey: "BesideCueGameDiagnosticsEnabled") as? Bool == true
    }
    static let store = GameDiagnosticStore(
        file: FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("BesideCueDiagnostics/events-v1.json"),
        version: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown",
        build: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown")

    static func record(_ kind: String) {
        guard enabled else { return }
        store.record(kind)
    }
}
