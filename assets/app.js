(() => {
  'use strict';

  const contractAddress = '0xc2C71a850875d028c8d48047C5a6c11d0C434490';
  const logoUrl = 'https://token-metadata-sepolia.maurenemarritt.workers.dev/assets/logo-distribution.png';
  const sepoliaChainId = '0xaa36a7';
  const importButton = document.querySelector('[data-import-token]');
  const copyButton = document.querySelector('[data-copy-address]');
  const status = document.querySelector('[data-status]');

  function showStatus(message, kind = '') {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function findProvider() {
    const injected = window.ethereum;
    if (!injected) return null;

    const providers = Array.isArray(injected.providers)
      ? injected.providers
      : [injected];

    return providers.find((candidate) =>
      candidate?.isMetaMask && typeof candidate.request === 'function'
    ) || providers.find((candidate) =>
      candidate && typeof candidate.request === 'function'
    ) || null;
  }

  let provider = null;

  function refreshProviderStatus() {
    provider = findProvider();

    if (!provider) {
      showStatus('MetaMask no detectado. Abre esta página en Chrome con la extensión habilitada.', 'error');
    } else if (provider.isMetaMask) {
      showStatus('MetaMask detectado. Pulsa el botón para continuar.');
    } else {
      showStatus('Wallet inyectada detectada; no se pudo confirmar que sea MetaMask.');
    }
  }

  function isSepolia(chainId) {
    try {
      return BigInt(chainId) === 11155111n;
    } catch {
      return false;
    }
  }

  function isUserRejection(error) {
    return error?.code === 4001;
  }

  function getErrorMessage(error) {
    if (error?.code === 4902) {
      return 'Sepolia no está disponible en MetaMask. Añádela desde la configuración de redes y vuelve a intentarlo.';
    }

    if (typeof error?.message === 'string' && error.message.trim()) {
      return 'Error de MetaMask: ' + error.message;
    }

    return 'No se pudo completar la solicitud. Comprueba MetaMask y vuelve a intentarlo.';
  }

  window.addEventListener('ethereum#initialized', refreshProviderStatus, { once: true });
  refreshProviderStatus();

  importButton.addEventListener('click', async () => {
    provider = findProvider();

    if (!provider) {
      refreshProviderStatus();
      return;
    }

    importButton.disabled = true;

    try {
      let chainId = await provider.request({ method: 'eth_chainId' });

      if (!isSepolia(chainId)) {
        showStatus('Cambiando a Sepolia…');

        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: sepoliaChainId }]
          });
        } catch (error) {
          if (isUserRejection(error)) {
            showStatus('Usuario rechazó el cambio a Sepolia.', 'error');
            return;
          }

          throw error;
        }

        chainId = await provider.request({ method: 'eth_chainId' });
        if (!isSepolia(chainId)) {
          throw new Error('MetaMask no quedó conectada a Sepolia.');
        }
      }

      showStatus('Solicitud enviada a MetaMask. Puede mostrarse una confirmación en la wallet.');
      const result = await provider.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: contractAddress,
            symbol: 'USDT',
            decimals: 18,
            image: logoUrl
          }
        }
      });

      if (result === false) {
        showStatus('MetaMask no confirmó la solicitud. Comprueba si el token aparece en tu lista.');
      } else {
        showStatus(
          'Solicitud procesada por MetaMask. Comprueba tu lista para saber si el token se añadió; la respuesta true solo confirma que MetaMask reconoció la solicitud.',
          'success'
        );
      }
    } catch (error) {
      if (isUserRejection(error)) {
        showStatus('Usuario rechazó la solicitud de importación.', 'error');
      } else {
        showStatus(getErrorMessage(error), 'error');
      }
    } finally {
      importButton.disabled = false;
    }
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(contractAddress);
      copyButton.textContent = 'Copiado';
      window.setTimeout(() => { copyButton.textContent = 'Copiar'; }, 1800);
    } catch {
      showStatus('No se pudo copiar automáticamente. Puedes seleccionar la dirección mostrada.', 'error');
    }
  });
})();