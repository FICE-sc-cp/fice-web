import { getSafeExtension } from './upload.controller';
import { PUBLIC_MIME_EXTENSIONS } from './upload-types';

describe('getSafeExtension', () => {
  const ext = (mime: string, name: string) =>
    getSafeExtension(mime, name, PUBLIC_MIME_EXTENSIONS);

  it('keeps a matching extension and fixes a wrong one by the type', () => {
    expect(ext('video/quicktime', 'IMG_0042.MOV')).toBe('.mov');
    expect(ext('image/jpeg', 'photo.jpeg')).toBe('.jpeg');
    expect(ext('image/png', 'photo.exe')).toBe('.png');
    expect(ext('application/msword', 'cv.doc')).toBe('.doc');
  });

  it('trusts an allowed extension when the browser does not know the type', () => {
    expect(ext('application/octet-stream', 'cv.docx')).toBe('.docx');
    expect(ext('', 'clip.webm')).toBe('.webm');
  });

  it('refuses dangerous types whatever the name says', () => {
    expect(ext('image/svg+xml', 'logo.svg')).toBeNull();
    expect(ext('text/html', 'page.html')).toBeNull();
    expect(ext('application/octet-stream', 'setup.exe')).toBeNull();
    expect(ext('application/x-msdownload', 'run.bat')).toBeNull();
    expect(ext('image/gif', 'anim.gif')).toBeNull();
  });
});
