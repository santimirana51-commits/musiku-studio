package com.musikku;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.mediarouter.app.MediaRouteButton;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.NativePluginCall;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginManager;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Method;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(name = "App")
public class MainActivity extends AppCompatActivity {

    private FrameLayout webContainer;
    private ProgressBar progressBar;
    private ImageView errorIcon;
    private TextView errorText;
    private PluginManager pluginManager;
    private static final int REQUEST_CODE_MEDIA_PROJECTION = 1001;
    private static final int PERMISSION_REQUEST_CODE = 1002;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Make the activity fullscreen and immersive
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                        WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        setContentView(R.layout.activity_main);

        webContainer = findViewById(R.id.webContainer);
        progressBar = findViewById(R.id.progressBar);
        errorIcon = findViewById(R.id.errorIcon);
        errorText = findViewById(R.id.errorText);

        // Initialize Capacitor
        PluginManager.create(this, savedInstanceState).then(manager -> {
            this.pluginManager = manager;
            // Check permissions and start app
            checkPermissionsAndStart();
        }).exceptionally(ex -> {
            Log.e("MainActivity", "Failed to initialize Capacitor", ex);
            return null;
        });
    }

    private void checkPermissionsAndStart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (checkSelfPermission(Manifest.permission.FOREGROUND_SERVICE) == PackageManager.PERMISSION_GRANTED) {
                startApp();
            } else {
                requestPermissions(new String[]{
                        Manifest.permission.FOREGROUND_SERVICE,
                        Manifest.permission.READ_EXTERNAL_STORAGE,
                        Manifest.permission.WRITE_EXTERNAL_STORAGE
                }, PERMISSION_REQUEST_CODE);
            }
        } else {
            startApp();
        }
    }

    private void startApp() {
        // Set up MediaRouteButton for audio output routing
        MediaRouteButton mediaRouteButton = new MediaRouteButton(this);
        mediaRouteButton.setVisibility(View.GONE); // Hidden, system handles it

        // Request wake lock to keep screen on during playback
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK, "MusikKu:WakeLock");
            wakeLock.acquire();
        }

        // Show the web view
        // The web view is created by Capacitor automatically
        // We just need to make sure it's visible and properly configured

        // Request audio focus
        AudioManager audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (audioManager != null) {
            int result = audioManager.requestAudioFocus(null,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN);
            if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                Log.w("MainActivity", "Could not request audio focus");
            }
        }

        Log.d("MainActivity", "App started successfully");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                          @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean allGranted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            if (allGranted) {
                startApp();
            } else {
                Toast.makeText(this, "Izin ditolak. Beberapa fitur tidak akan berjalan.", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pluginManager != null) {
            pluginManager.onResume();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (pluginManager != null) {
            pluginManager.onPause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (pluginManager != null) {
            pluginManager.onDestroy();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (pluginManager != null) {
            pluginManager.onSaveInstanceState(outState);
        }
    }
}