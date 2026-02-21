import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let fileName: String
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        
        if let url = Bundle.main.url(forResource: fileName, withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) { }
}

struct ContentView: View {
    var body: some View {
        WebView(fileName: "index")
            .ignoresSafeArea()
    }
}