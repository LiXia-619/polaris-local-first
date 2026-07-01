import Capacitor
import Foundation
import UIKit

@objc(ScreenshotDebugPlugin)
public class ScreenshotDebugPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenshotDebugPlugin"
    public let jsName = "ScreenshotDebug"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleUserDidTakeScreenshot),
            name: UIApplication.userDidTakeScreenshotNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc public func getStatus(_ call: CAPPluginCall) {
        call.resolve([
            "supported": true
        ])
    }

    @objc private func handleUserDidTakeScreenshot() {
        notifyListeners("captured", data: [
            "at": Int(Date().timeIntervalSince1970 * 1000)
        ])
    }
}
