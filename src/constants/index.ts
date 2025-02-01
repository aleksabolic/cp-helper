export const EXTENSION_NAME = 'cp-helper';
export const COMMAND_PREFIX = `${EXTENSION_NAME}.`;

export const STATUS_BAR_ITEMS = {
  CREATE_FILE: {
    text: '$(new-file) Create new file',
    command: `${COMMAND_PREFIX}createNewFile`
  },
  CREATE_CONTEST: {
    text: '$(new-folder) Create Contest',
    command: `${COMMAND_PREFIX}createContest`
  }
};