export default function AxisAssistant() {
  return (
    <>
      <button className="jarvis-fab" id="jarvisFab" onClick={() => window.toggleJarvis()} title="Axis — AI Assistant">
        &#10022;
      </button>
      <div className="jarvis-panel" id="jarvisPanel">
        <div className="jarvis-panel-header">
          <div className="jarvis-status-dot" id="jarvisStatusDot"></div>
          <div className="jarvis-panel-title" id="jarvisPanelTitle">Axis</div>
          <button
            className="jarvis-wake-btn enabled"
            id="jarvisWakeBtn"
            onClick={() => window.toggleWakeWord()}
            title={'Wake word ON ("Hey Axis") — tap to disable'}
          >
            &#127908;
          </button>
          <button
            className="jarvis-voice-btn enabled"
            id="jarvisVoiceBtn"
            onClick={() => window.toggleJarvisVoice()}
            title="Voice readback ON — tap to mute"
          >
            &#128266;
          </button>
          <button className="jarvis-close" onClick={() => window.toggleJarvis()}>&#10005;</button>
        </div>
        <div className="jarvis-messages" id="jarvisMessages">
          <div className="jarvis-greeting">How can I help you today?</div>
        </div>
        <div className="jarvis-input-row">
          <textarea
            className="jarvis-input"
            id="jarvisInput"
            placeholder="Ask anything or give a command..."
            rows={1}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.jarvisSend();
              }
            }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 90) + 'px';
            }}
          ></textarea>
          <button className="jarvis-mic" id="jarvisMicBtn" onClick={() => window.jarvisToggleMic()} title="Voice input">
            &#127908;
          </button>
          <button className="jarvis-send" id="jarvisSendBtn" onClick={() => window.jarvisSend()} title="Send">
            &#9650;
          </button>
        </div>
      </div>
    </>
  );
}
