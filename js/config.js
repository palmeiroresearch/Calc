const APP_VERSION = '1.2.0';

const BUTTON_LAYOUT = [
    { label: 'AC', type: 'utility',  value: 'AC', id: 'btn-clear',   wide: false },
    { label: '±',  type: 'utility',  value: '±',  id: 'btn-sign',    wide: false },
    { label: '%',  type: 'utility',  value: '%',  id: 'btn-percent', wide: false },
    { label: '÷',  type: 'operator', value: '/',  id: 'btn-div',     wide: false },

    { label: '7',  type: 'number',   value: '7',  id: 'btn-7',       wide: false },
    { label: '8',  type: 'number',   value: '8',  id: 'btn-8',       wide: false },
    { label: '9',  type: 'number',   value: '9',  id: 'btn-9',       wide: false },
    { label: '×',  type: 'operator', value: '*',  id: 'btn-mul',     wide: false },

    { label: '4',  type: 'number',   value: '4',  id: 'btn-4',       wide: false },
    { label: '5',  type: 'number',   value: '5',  id: 'btn-5',       wide: false },
    { label: '6',  type: 'number',   value: '6',  id: 'btn-6',       wide: false },
    { label: '−',  type: 'operator', value: '-',  id: 'btn-sub',     wide: false },

    { label: '1',  type: 'number',   value: '1',  id: 'btn-1',       wide: false },
    { label: '2',  type: 'number',   value: '2',  id: 'btn-2',       wide: false },
    { label: '3',  type: 'number',   value: '3',  id: 'btn-3',       wide: false },
    { label: '+',  type: 'operator', value: '+',  id: 'btn-add',     wide: false },

    { label: '0',  type: 'number',   value: '0',  id: 'btn-0',       wide: true  },
    { label: '.',  type: 'decimal',  value: '.',  id: 'btn-dot',     wide: false },
    { label: '=',  type: 'equals',   value: '=',  id: 'btn-eq',      wide: false },
];
