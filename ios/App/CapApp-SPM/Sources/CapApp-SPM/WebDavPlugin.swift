import Capacitor
import Foundation

@objc(WebDavPlugin)
public class WebDavPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WebDavPlugin"
    public let jsName = "WebDav"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "listDirectory", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uploadFile", returnType: CAPPluginReturnPromise)
    ]

    @objc public func listDirectory(_ call: CAPPluginCall) {
        request(
            call: call,
            method: "PROPFIND",
            extraHeaders: [
                "Depth": "1",
                "Accept": "application/xml, text/xml;q=0.9, */*;q=0.8",
                "Content-Type": "application/xml; charset=utf-8"
            ]
        )
    }

    @objc public func downloadFile(_ call: CAPPluginCall) {
        request(call: call, method: "GET", expectsBinary: true)
    }

    @objc public func uploadFile(_ call: CAPPluginCall) {
        guard let dataBase64 = call.getString("dataBase64"), let data = Data(base64Encoded: dataBase64) else {
            call.reject("WebDAV 上传内容格式不正确。")
            return
        }

        request(
            call: call,
            method: "PUT",
            extraHeaders: [
                "Content-Type": call.getString("mimeType") ?? "application/zip"
            ],
            body: data
        )
    }

    private func request(
        call: CAPPluginCall,
        method: String,
        extraHeaders: [String: String] = [:],
        body: Data? = nil,
        expectsBinary: Bool = false
    ) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("WebDAV 地址不正确。")
            return
        }

        let username = call.getString("username") ?? ""
        let password = call.getString("password") ?? ""

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("Basic \(authorizationValue(username: username, password: password))", forHTTPHeaderField: "Authorization")
        for (key, value) in extraHeaders {
            request.setValue(value, forHTTPHeaderField: key)
        }

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error {
                DispatchQueue.main.async {
                    call.reject(self.requestFailureMessage(method: method, error: error), nil, error)
                }
                return
            }

            guard let httpResponse = response as? HTTPURLResponse else {
                DispatchQueue.main.async {
                    call.reject("WebDAV 响应不完整。")
                }
                return
            }

            var result: [String: Any] = [
                "statusCode": httpResponse.statusCode
            ]

            if expectsBinary {
                if let mimeType = httpResponse.value(forHTTPHeaderField: "Content-Type") {
                    result["mimeType"] = mimeType.components(separatedBy: ";").first?.trimmingCharacters(in: .whitespacesAndNewlines) ?? mimeType
                }
                if let data {
                    result["dataBase64"] = data.base64EncodedString()
                }
            } else if let data, !data.isEmpty {
                result["body"] = String(data: data, encoding: .utf8) ?? ""
            }

            DispatchQueue.main.async {
                call.resolve(result)
            }
        }.resume()
    }

    private func authorizationValue(username: String, password: String) -> String {
        Data("\(username):\(password)".utf8).base64EncodedString()
    }

    private func requestFailureMessage(method: String, error: Error) -> String {
        let action: String
        switch method {
        case "PUT":
            action = "上传 WebDAV 备份"
        case "PROPFIND":
            action = "读取 WebDAV 目录"
        case "GET":
            action = "下载 WebDAV 备份"
        default:
            action = "WebDAV 请求"
        }

        let nsError = error as NSError
        let detail = nsError.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let suffix = detail.isEmpty ? "" : "：\(detail)"
        return "\(action)失败\(suffix)（\(nsError.domain) \(nsError.code)）"
    }
}
