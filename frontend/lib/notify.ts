import toast, { type ToastOptions } from "react-hot-toast";

const NETWORK_TOAST_ID = "network-status";

export const notify = {
  success(message: string, options?: ToastOptions) {
    return toast.success(message, options);
  },

  error(message: string, options?: ToastOptions) {
    return toast.error(message, options);
  },

  info(message: string, options?: ToastOptions) {
    return toast(message, options);
  },

  networkOffline() {
    return toast.error(
      "You are offline. Requests will resume when connection returns.",
      {
        id: NETWORK_TOAST_ID,
        duration: Infinity,
      },
    );
  },

  networkOnline() {
    return toast.success("Back online. Syncing latest status...", {
      id: NETWORK_TOAST_ID,
      duration: 2500,
    });
  },

  dismiss(id?: string) {
    toast.dismiss(id);
  },
};

export { NETWORK_TOAST_ID };
