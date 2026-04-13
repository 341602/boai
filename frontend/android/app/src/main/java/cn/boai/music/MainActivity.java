package cn.boai.music;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private final OnBackPressedCallback appBackPressedCallback = new OnBackPressedCallback(true) {
        @Override
        public void handleOnBackPressed() {
            dispatchBackToWebLayer();
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BoAiMusicPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, appBackPressedCallback);
    }

    private void dispatchBackToWebLayer() {
        Bridge activeBridge = getBridge();

        if (activeBridge == null || activeBridge.getWebView() == null) {
            finish();
            return;
        }

        WebView webView = activeBridge.getWebView();
        String script =
            "(function() {" +
                "try {" +
                    "if (typeof window.__BOAI_HANDLE_ANDROID_BACK__ === 'function') {" +
                        "return window.__BOAI_HANDLE_ANDROID_BACK__() ? 'handled' : 'exit';" +
                    "}" +
                    "return 'exit';" +
                "} catch (error) {" +
                    "return 'exit';" +
                "}" +
            "})();";

        webView.post(() ->
            webView.evaluateJavascript(script, value -> {
                String result = value == null ? "" : value.replace("\"", "");

                runOnUiThread(() -> {
                    if ("handled".equals(result)) {
                        return;
                    }

                    if (webView.canGoBack()) {
                        webView.goBack();
                        return;
                    }

                    finish();
                });
            })
        );
    }
}
