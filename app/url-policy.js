function createUrlPolicy({ path, fileURLToPath, appRoot, sitePattern }) {
  function isTrustedAppEvent(event) {
    try {
      const frame = event.senderFrame;
      if (!frame || frame !== event.sender.mainFrame) return false;
      const url = new URL(frame.url);
      if (url.protocol !== 'file:') return false;
      const filePath = path.resolve(fileURLToPath(url));
      const relative = path.relative(appRoot, filePath);
      return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    } catch {
      return false;
    }
  }

  function isTrustedAuthUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return false;
      const host = url.hostname.toLowerCase();
      return host === 'accounts.google.com' || host === 'apis.google.com'
        || host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com')
        || host === 'oauth.telegram.org' || host === 'telegram.org' || host.endsWith('.telegram.org');
    } catch {
      return false;
    }
  }

  function isAuthFlowUrl(value) {
    if (isTrustedAuthUrl(value)) return true;
    try {
      const url = new URL(value);
      return sitePattern.test(url.href) && /\/(login|signin|auth|oauth)(?:\/|$)/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  return { isAuthFlowUrl, isTrustedAppEvent, isTrustedAuthUrl };
}

module.exports = { createUrlPolicy };
