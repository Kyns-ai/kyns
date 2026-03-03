import { atomWithLocalStorage } from '~/store/utils';

const isTemporary = atomWithLocalStorage('isTemporary', true);
const defaultTemporaryChat = atomWithLocalStorage('defaultTemporaryChat', false);

export default {
  isTemporary,
  defaultTemporaryChat,
};
