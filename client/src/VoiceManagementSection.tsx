import { VoiceUploadForm } from './VoiceUploadForm';

/** Voice-library CRUD, relocated here from Create's VoicePicker (which is select-only now). */
export function VoiceManagementSection() {
  return (
    <div className="settings-card">
      <span className="section-label">VOICES</span>
      <div className="hint">reference-audio clips used to condition generation — upload, rename, or delete here</div>
      <VoiceUploadForm />
    </div>
  );
}
