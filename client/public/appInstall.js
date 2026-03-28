// Detect if the app can be installed
let deferredPrompt;
const installPrompt = document.getElementById('app-install-prompt');
const installButton = document.getElementById('install-button');
const dismissButton = document.getElementById('dismiss-button');

// Hide the install prompt initially
if (installPrompt) {
  installPrompt.style.display = 'none';
}

// Detect if the app can be installed (browser supports PWA installation)
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show the install button
  if (installPrompt) {
    installPrompt.style.display = 'block';
  }
  
  // Log that the app is installable
  console.log('Multi Land app is installable');
});

// Add click event to install button
if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) {
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // Log the outcome
    console.log(`User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} the install prompt`);
    
    // We've used the prompt, so we can't use it again
    deferredPrompt = null;
    
    // Hide the install prompt
    installPrompt.style.display = 'none';
  });
}

// Add click event to dismiss button
if (dismissButton) {
  dismissButton.addEventListener('click', () => {
    // Hide the install prompt
    installPrompt.style.display = 'none';
    
    // Log that the user dismissed the install prompt
    console.log('User dismissed the install prompt');
  });
}

// Add event for when the app is successfully installed
window.addEventListener('appinstalled', (e) => {
  // Log the installation
  console.log('Multi Land app installed successfully');
  
  // Hide the install prompt
  if (installPrompt) {
    installPrompt.style.display = 'none';
  }
});