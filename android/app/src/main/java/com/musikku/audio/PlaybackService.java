package com.musikku.audio;

import android.app.Service;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSession;
import android.media.session.MediaSessionCompat;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ResultReceiver;

import com.musikku.R;

public class PlaybackService extends Service {

    private MediaSessionCompat mediaSession;
    private boolean isPlaying = false;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        setupMediaSession();
    }

    private void setupMediaSession() {
        mediaSession = new MediaSessionCompat(this, "MusikKuPlayback");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);

        mediaSession.setMediaButtonReceiver(null);

        MediaController.Builder builder = new MediaController.Builder(this, mediaSession.getSessionToken());
        mediaSession.setController(builder.build());

        mediaSession.setCallback(new MediaSessionCallback());
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (action != null) {
                handleAction(action);
            }
        }
        return START_STICKY;
    }

    private void handleAction(String action) {
        switch (action) {
            case "android.intent.action.PLAY":
                isPlaying = true;
                Log.d("PlaybackService", "Play received");
                break;
            case "android.intent.action.PAUSE":
                isPlaying = false;
                Log.d("PlaybackService", "Pause received");
                break;
            case "android.intent.action.STOP":
                isPlaying = false;
                Log.d("PlaybackService", "Stop received");
                break;
            default:
                break;
        }
        updateMetaData();
        return START_STICKY;
    }

    private void updateMetaData() {
        if (mediaSession == null) return;
        MediaMetadata.Builder builder = new MediaMetadata.Builder();
        builder.putString(MediaMetadata.METADATA_KEY_TITLE, "MusikKu");
        builder.putString(MediaMetadata.METADATA_KEY_ARTIST, "MusikKu App");
        if (isPlaying) {
            builder.putString(MediaMetadata.METADATA_KEY_MEDIA_ID, "now-playing");
            builder.putLong(MediaMetadata.METADATA_KEY_DURATION, 180000);
        }
        mediaSession.setMetadata(builder.build());
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (mediaSession != null) {
            mediaSession.setActive(false);
        }
    }

    public class MediaSessionCallback extends MediaSessionCompat.Callback {
        @Override
        public void onPlay() {
            super.onPlay();
            isPlaying = true;
            updateMetaData();
        }

        @Override
        public void onPause() {
            super.onPause();
            isPlaying = false;
            updateMetaData();
        }

        @Override
        public void onStop() {
            super.onStop();
            isPlaying = false;
            updateMetaData();
        }
    }
}