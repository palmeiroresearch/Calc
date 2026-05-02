class Calculator {
    constructor() {
        this._reset();
    }

    _reset() {
        this.displayValue   = '0';
        this.firstOperand   = null;
        this.operator       = null;
        this.waitingForSecond = false;
        this.lastOperator   = null;
        this.lastOperand    = null;
        this.justCalculated = false;
    }

    _compute(a, op, b) {
        switch (op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return b === 0 ? null : a / b;
            default:  return b;
        }
    }

    _format(value) {
        if (value === null || !isFinite(value)) return 'Error';

        const abs = Math.abs(value);

        if (abs !== 0 && (abs >= 1e10 || abs < 1e-6)) {
            let sci = value.toPrecision(9);
            // Clean up: remove trailing zeros in mantissa
            sci = sci.replace(/(\.\d*?)0+(e)/, '$1$2').replace(/\.(e)/, '$1');
            return sci;
        }

        // Use locale formatting for commas
        let formatted = Number(value).toLocaleString('en-US', {
            maximumFractionDigits: 9,
            useGrouping: true,
        });

        // Strip trailing zeros after decimal
        if (formatted.includes('.')) {
            formatted = formatted.replace(/\.?0+$/, '');
        }

        return formatted;
    }

    _getState() {
        return {
            display:        this.displayValue,
            showClear:      this.displayValue !== '0' || this.firstOperand !== null,
            activeOperator: this.waitingForSecond ? this.operator : null,
        };
    }

    inputDigit(digit) {
        if (this.waitingForSecond) {
            this.displayValue = digit === '0' ? '0' : digit;
            this.waitingForSecond = false;
            this.justCalculated = false;
        } else {
            if (this.justCalculated) {
                // Start fresh after = press
                this.displayValue = digit === '0' ? '0' : digit;
                this.firstOperand = null;
                this.operator = null;
                this.justCalculated = false;
            } else {
                // Suppress leading zeros
                if (this.displayValue === '0' && digit !== '.') {
                    this.displayValue = digit;
                } else {
                    // Cap at 9 significant characters (ignoring commas and minus sign)
                    const raw = this.displayValue.replace(/[,]/g, '');
                    if (raw.replace('-', '').replace('.', '').length >= 9) {
                        return this._getState();
                    }
                    this.displayValue += digit;
                }
            }
        }
        return this._getState();
    }

    inputDecimal() {
        if (this.waitingForSecond) {
            this.displayValue = '0.';
            this.waitingForSecond = false;
            return this._getState();
        }
        if (this.justCalculated) {
            this.displayValue = '0.';
            this.firstOperand = null;
            this.operator = null;
            this.justCalculated = false;
            return this._getState();
        }
        if (!this.displayValue.includes('.')) {
            this.displayValue += '.';
        }
        return this._getState();
    }

    inputOperator(op) {
        const current = parseFloat(this.displayValue);

        if (this.firstOperand !== null && !this.waitingForSecond) {
            // Chain: compute pending operation first
            const result = this._compute(this.firstOperand, this.operator, current);
            if (result === null) {
                this.displayValue = 'Error';
                this._reset();
                return this._getState();
            }
            this.firstOperand = result;
            this.displayValue = this._format(result);
        } else {
            this.firstOperand = current;
        }

        this.operator = op;
        this.waitingForSecond = true;
        this.lastOperator = null; // reset repeat-equals on new operator
        this.lastOperand = null;
        this.justCalculated = false;
        return this._getState();
    }

    calculate() {
        let result;

        if (this.justCalculated && this.lastOperator !== null) {
            // Repeat last operation
            result = this._compute(parseFloat(this.displayValue), this.lastOperator, this.lastOperand);
        } else if (this.firstOperand !== null && this.operator !== null) {
            const second = parseFloat(this.displayValue);
            this.lastOperator = this.operator;
            this.lastOperand  = second;
            result = this._compute(this.firstOperand, this.operator, second);
        } else {
            return this._getState();
        }

        if (result === null) {
            this.displayValue = 'Error';
            this._reset();
            return this._getState();
        }

        this.displayValue   = this._format(result);
        this.firstOperand   = null;
        this.operator       = null;
        this.waitingForSecond = false;
        this.justCalculated = true;
        return this._getState();
    }

    clear() {
        if (this.displayValue !== '0' && !this.justCalculated) {
            // C — clear only current input
            this.displayValue = '0';
            this.waitingForSecond = false;
        } else {
            // AC — full reset
            this._reset();
        }
        return this._getState();
    }

    toggleSign() {
        if (this.displayValue === '0' || this.displayValue === 'Error') return this._getState();
        const val = parseFloat(this.displayValue.replace(/,/g, ''));
        const negated = -val;
        this.displayValue = this._format(negated);
        // If we just negated after =, treat as ongoing edit
        if (this.justCalculated) {
            this.firstOperand = null;
            this.operator = null;
            this.justCalculated = false;
        }
        return this._getState();
    }

    inputPercent() {
        if (this.displayValue === 'Error') return this._getState();
        const current = parseFloat(this.displayValue.replace(/,/g, ''));
        let result;
        if (this.firstOperand !== null && (this.operator === '+' || this.operator === '-')) {
            // e.g. 200 + 10% → 10% of 200 = 20
            result = this.firstOperand * (current / 100);
        } else {
            result = current / 100;
        }
        this.displayValue = this._format(result);
        this.justCalculated = false;
        return this._getState();
    }

    getState() {
        return this._getState();
    }
}
