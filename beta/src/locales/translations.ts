/**
 * Locale definitions
 * Ported from AngularJS hex-works app
 */

export interface Locale {
  // General
  open: string;
  save: string;
  saveAs: string;
  new: string;
  close: string;
  
  // Actions
  copyclip: string;
  paste: string;
  cut: string;
  undo: string;
  redo: string;
  selectAll: string;
  
  // Help
  information: string;
  helpheading: string;
  
  // Inspector
  inspector: string;
  normalorder: string;
  reverseorder: string;
  current: string;
  of: string;
  checksum: string;
  
  // Tabs/Compare
  apply: string;
  compare: string;
  
  // Search
  search: string;
  find: string;
  findNext: string;
  replace: string;
  hexSearch: string;
  textSearch: string;
  caseSensitive: string;
  notFound: string;
  foundAt: string;
  
  // Color marking
  markColor: string;
  clearMarkers: string;
  
  // Operations
  swapBytes: string;
  fillWith: string;
  xorWith: string;
  
  // File info
  fileName: string;
  fileSize: string;
  modified: string;
  
  // Scripting
  script: string;

  // Status
  loading: string;
  saving: string;
  ready: string;
  error: string;
}

export const englocale: Locale = {
  // General
  open: 'Open',
  save: 'Save',
  saveAs: 'Save As',
  new: 'New',
  close: 'Close',
  
  // Actions
  copyclip: 'Copy to Clipboard',
  paste: 'Paste',
  cut: 'Cut',
  undo: 'Undo',
  redo: 'Redo',
  selectAll: 'Select All',
  
  // Help
  information: 'Help',
  helpheading: 'Hex-editor help',
  
  // Inspector
  inspector: 'Inspector',
  normalorder: 'Normal order',
  reverseorder: 'Reverse order',
  current: 'Current',
  of: 'of',
  checksum: 'Checksum',
  
  // Tabs/Compare
  apply: 'Apply this colorset to all tabs',
  compare: 'Compare to',
  
  // Search
  search: 'Search',
  find: 'Find',
  findNext: 'Find Next',
  replace: 'Replace',
  hexSearch: 'Hex Search',
  textSearch: 'Text Search',
  caseSensitive: 'Case sensitive',
  notFound: 'Not found',
  foundAt: 'Found at',
  
  // Color marking
  markColor: 'Mark with Color',
  clearMarkers: 'Clear Markers',
  
  // Operations
  swapBytes: 'Swap Bytes',
  fillWith: 'Fill with',
  xorWith: 'XOR with',
  
  // File info
  fileName: 'File name',
  fileSize: 'Size',
  modified: 'Modified',
  
  // Scripting
  script: 'Script',

  // Status
  loading: 'Loading...',
  saving: 'Saving...',
  ready: 'Ready',
  error: 'Error',
};

export const ruslocale: Locale = {
  // General
  open: 'Открыть',
  save: 'Сохранить',
  saveAs: 'Сохранить как',
  new: 'Новый',
  close: 'Закрыть',
  
  // Actions
  copyclip: 'Скопировать',
  paste: 'Вставить',
  cut: 'Вырезать',
  undo: 'Отменить',
  redo: 'Повторить',
  selectAll: 'Выбрать все',
  
  // Help
  information: 'Помощь',
  helpheading: 'Помощь по hex редактору',
  
  // Inspector
  inspector: 'Инспектор',
  normalorder: 'Нормальный порядок',
  reverseorder: 'Обратный порядок',
  current: 'Текущий',
  of: 'из',
  checksum: 'Контрольная сумма',
  
  // Tabs/Compare
  apply: 'Применить цветовую схему ко всем табам',
  compare: 'Сравнить с',
  
  // Search
  search: 'Поиск',
  find: 'Найти',
  findNext: 'Найти далее',
  replace: 'Заменить',
  hexSearch: 'Поиск Hex',
  textSearch: 'Поиск текста',
  caseSensitive: 'Учитывать регистр',
  notFound: 'Не найдено',
  foundAt: 'Найдено в',
  
  // Color marking
  markColor: 'Отметить цветом',
  clearMarkers: 'Очистить маркеры',
  
  // Operations
  swapBytes: 'Поменять байты',
  fillWith: 'Заполнить',
  xorWith: 'XOR с',
  
  // File info
  fileName: 'Имя файла',
  fileSize: 'Размер',
  modified: 'Изменен',
  
  // Scripting
  script: 'Скрипт',

  // Status
  loading: 'Загрузка...',
  saving: 'Сохранение...',
  ready: 'Готово',
  error: 'Ошибка',
};

export default { eng: englocale, rus: ruslocale };
