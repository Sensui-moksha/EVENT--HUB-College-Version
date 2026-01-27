import { useState, useCallback } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

interface AlertOptions {
  title: string;
  message: string;
  buttonText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

/**
 * Hook for showing confirmation and alert dialogs
 * Returns styled modal components and functions to trigger them
 */
export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    options: AlertOptions;
  } | null>(null);

  const [loading, setLoading] = useState(false);

  /**
   * Show a confirmation dialog
   * @returns Promise that resolves to true if confirmed, false if cancelled
   */
  const confirm = useCallback((
    options: ConfirmOptions
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        onConfirm: async () => {
          setLoading(true);
          resolve(true);
          setLoading(false);
          setConfirmState(null);
        },
      });

      // Handle cancel
      const handleCancel = () => {
        resolve(false);
        setConfirmState(null);
      };

      // Store cancel handler for later use
      (setConfirmState as any).cancel = handleCancel;
    });
  }, []);

  /**
   * Show an alert dialog
   */
  const alert = useCallback((options: AlertOptions) => {
    setAlertState({
      isOpen: true,
      options,
    });
  }, []);

  /**
   * Render the modal components
   */
  const ConfirmDialog = () => (
    <>
      {confirmState && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          onClose={() => {
            ((setConfirmState as any).cancel || (() => {}))();
          }}
          onConfirm={confirmState.onConfirm}
          title={confirmState.options.title}
          message={confirmState.options.message}
          confirmText={confirmState.options.confirmText}
          cancelText={confirmState.options.cancelText}
          variant={confirmState.options.variant}
          loading={loading}
        />
      )}
      {alertState && (
        <AlertModal
          isOpen={alertState.isOpen}
          onClose={() => setAlertState(null)}
          title={alertState.options.title}
          message={alertState.options.message}
          buttonText={alertState.options.buttonText}
          variant={alertState.options.variant}
        />
      )}
    </>
  );

  return {
    confirm,
    alert,
    ConfirmDialog,
  };
};

export default useConfirm;
