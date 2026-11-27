/** Play build: nothing can be downloaded, so there is never a saved copy. */
import type * as Real from './manager';

export const useDownload: typeof Real.useDownload = () => undefined;
export const readSavedReviews: typeof Real.readSavedReviews = () => ({});
export const saveReviews: typeof Real.saveReviews = () => {};
export const deleteDownload: typeof Real.deleteDownload = () => {};
export const addTranscript: typeof Real.addTranscript = () => {};
