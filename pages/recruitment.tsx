import Head from 'next/head';
import Link from 'next/link';
import { ChangeEvent, useState } from 'react';
import { ArrowLeft, Camera, Check, UserSearch, X } from 'lucide-react';

const professions: Array<{ value: string; label: string }> = [
  { value: 'mason', label: 'Mason' },
  { value: 'carpenter', label: 'Carpenter' },
  { value: 'bar_bender', label: 'Bar Bender' },
  { value: 'labour', label: 'Labour' },
];

const emptyForm = {
  name: '',
  nationality: '',
  passport_number: '',
  birth_date: '',
  profession: 'labour',
  photo_data_url: '',
};

const prepareSelfie = (file: File): Promise<string> => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - size) / 2;
    const sourceY = (image.naturalHeight - size) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    canvas.getContext('2d')?.drawImage(image, sourceX, sourceY, size, size, 0, 0, 256, 256);
    URL.revokeObjectURL(objectUrl);
    const result = canvas.toDataURL('image/jpeg', 0.72);
    if (result.length > 280_000) return reject(new Error('The image is too large. Please choose a smaller photo.'));
    resolve(result);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('This image could not be read. Please choose another photo.'));
  };
  image.src = objectUrl;
});

export default function Recruitment() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedName, setSubmittedName] = useState('');

  const selectSelfie = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const photo = await prepareSelfie(file);
      setForm((current) => ({ ...current, photo_data_url: photo }));
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Could not prepare this photo.');
    } finally {
      event.target.value = '';
    }
  };

  const submit = async () => {
    setError('');
    if (!form.name.trim()) return setError('Full name is required.');
    setSubmitting(true);
    try {
      const res = await fetch('/api/public/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          nationality: form.nationality.trim(),
          passport_number: form.passport_number.trim(),
          birth_date: form.birth_date,
          profession: form.profession,
          photo_data_url: form.photo_data_url,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'submit-failed');
      }
      const data = await res.json();
      setSubmittedName(data.name || form.name.trim());
    } catch (submitError) {
      setError(submitError instanceof Error && submitError.message !== 'submit-failed' ? submitError.message : 'Could not submit this candidate. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return <>
    <Head><title>New Employee Recruitment | CloveHR</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <main className="login-page ot-page">
      <section className="login-card ot-card">
        <div className="login-brand"><span><UserSearch size={25} /></span><div><p>CLOVE HR</p><h1>New Employee Recruitment</h1></div></div>

        {!submittedName ? (
          <>
            <p className="login-copy">Add a candidate&rsquo;s details below. You will be contacted by Clove if you are selected for the job. No login is required.</p>
            <div className="form-grid compact-grid">
              <label className="recruitment-photo-field"><span>Profile selfie <small>(optional)</small></span>
                <span className="recruitment-photo-control">
                  {form.photo_data_url ? (
                    <span className="recruitment-photo-preview">
                      <img src={form.photo_data_url} alt="Selected profile selfie" />
                      <button type="button" aria-label="Remove profile selfie" onClick={() => setForm((current) => ({ ...current, photo_data_url: '' }))}><X size={14} /></button>
                    </span>
                  ) : <span className="recruitment-photo-placeholder"><Camera size={22} /></span>}
                  <span className="soft-button compact recruitment-photo-button"><Camera size={15} /> Choose selfie
                    <input type="file" accept="image/*" capture="user" onChange={selectSelfie} />
                  </span>
                </span>
                <small className="field-hint">The photo is automatically cropped and reduced to a tiny profile image.</small>
              </label>
              <label><span>Full name</span>
                <input type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label><span>Nationality</span>
                <input type="text" value={form.nationality} onChange={(event) => setForm({ ...form, nationality: event.target.value })} />
              </label>
              <label><span>Passport number</span>
                <input type="text" value={form.passport_number} onChange={(event) => setForm({ ...form, passport_number: event.target.value })} />
              </label>
              <label><span>Date of birth</span>
                <input type="date" value={form.birth_date} onChange={(event) => setForm({ ...form, birth_date: event.target.value })} />
              </label>
              <label><span>Profession</span>
                <select value={form.profession} onChange={(event) => setForm({ ...form, profession: event.target.value })}>
                  {professions.map((profession) => <option key={profession.value} value={profession.value}>{profession.label}</option>)}
                </select>
              </label>
            </div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="dark-button full" type="button" disabled={submitting} onClick={submit}>
              {submitting ? 'Submitting...' : <>Submit candidate <UserSearch size={16} /></>}
            </button>
            <Link className="text-link ot-back-link" href="/login"><ArrowLeft size={14} /> Back to sign in</Link>
          </>
        ) : (
          <div className="wizard-panel attendance-success">
            <UserSearch size={30} />
            <h3>Candidate submitted</h3>
            <p>{submittedName} has been recorded as a recruitment candidate. This is independent of the employee roster until someone is formally onboarded.</p>
            <button className="dark-button" type="button" onClick={() => { setSubmittedName(''); setForm(emptyForm); }}><Check size={16} /> Add another candidate</button>
            <Link className="text-link ot-back-link" href="/login"><ArrowLeft size={14} /> Back to sign in</Link>
          </div>
        )}
      </section>
    </main>
  </>;
}
