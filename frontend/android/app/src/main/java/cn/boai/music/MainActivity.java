package cn.boai.music;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BoAiMusicPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
