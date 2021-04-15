const VM = new (require('vm2').VM)();
const Rule = '\"[^\"]+\"|\'[^\']+\'|url\\([^)]+\\)|var\\([^)]+\\)|(\\d*\\.?\\d+)';

const computeUnit = (math = '', value = 0, unit = '', decimal = 5) => {
    try {
        let number = VM.run(math.replace(/\$word/g, value));
        if (typeof number === 'number') {
            let powNumber = Math.pow(10, decimal + 1);
            let floorNumber = Math.floor(number * powNumber);
            let roundNumber = (Math.round(floorNumber / 10) * 10) / powNumber;
            return `${roundNumber}${roundNumber !== 0 ? unit : ''}`;
        } else {
            throw new Error('The formula should not carry strings.');
        }
    } catch (error) {
        return undefined;
    }
};

const replaceUnit = (rule = '', math = '', unit = '', value = '') => {
    return value.replace(rule, (item, content) => {
        if (content !== undefined) {
            return computeUnit(math, content, unit) || 0;
        } else {
            return item;
        }
    });
};

const verifyPropList = (propList = []) => {
    let isHasWild = propList.indexOf('*') !== -1;
    let isIgnoreMatch = isHasWild && propList.length === 1;
    let isMatchExact = propList.filter(item => item.match(/^[^*!]+$/));
    let isMatchBetween = propList.filter(item => item.match(/^\*.+\*$/)).map(item => item.substr(1, item.length - 2));
    let isMatchStart = propList.filter(item => item.match(/^[^*!]+\*$/)).map(item => item.substr(0, item.length - 1));
    let isMatchEnd = propList.filter(item => item.match(/^\*[^*]+$/)).map(item => item.substr(1));
    let isNotMatchExact = propList.filter(item => item.match(/^![^*]+$/)).map(item => item.substr(1));
    let isNotMatchBetween = propList.filter(item => item.match(/^!\*.+\*$/)).map(item => item.substr(2, item.length - 3));
    let isNotMatchStart = propList.filter(item => item.match(/^![^*]+\*$/)).map(item => item.substr(1, item.length - 2));
    let isNotMatchEnd = propList.filter(item => item.match(/^!\*[^*]+$/)).map(item => item.substr(2));
    return prop => {
        if (isIgnoreMatch) { return true; }
        if (isNotMatchExact.indexOf(prop) !== -1) {
            return false;
        } else if (isNotMatchBetween.some(item => prop.indexOf(item) !== -1)) {
            return false;
        } else if (isNotMatchStart.some(item => prop.indexOf(item) === 0)) {
            return false;
        } else if (isNotMatchEnd.some(item => prop.indexOf(item) === prop.length - item.length)) {
            return false;
        } else if (isMatchExact.indexOf(prop) !== -1) {
            return true;
        } else if (isMatchBetween.some(item => prop.indexOf(item) !== -1)) {
            return true;
        } else if (isMatchStart.some(item => prop.indexOf(item) === 0)) {
            return true;
        } else if (isMatchEnd.some(item => prop.indexOf(item) === prop.length - item.length)) {
            return true;
        } else {
            return isHasWild;
        }
    };
};

const initOptions = options => {
    let defaultOptions = { unitList: [], propList: ['*'], replace: true, media: true };
    if (typeof options === 'object') {
        if (Array.isArray(options.unitList)) {
            options.unitList.forEach(item => {
                if (item.math && item.word && item.unit) {
                    item.rule = new RegExp(Rule + item.word, 'g');
                    if (computeUnit(item.math, 0, item.unit) !== undefined) {
                        defaultOptions.unitList.push(item);
                    }
                }
            });
        }
        if (Array.isArray(options.propList)) {
            defaultOptions.propList = options.propList;
        }
        if (typeof options.replace === 'boolean') {
            defaultOptions.replace = options.replace;
        }
        if (typeof options.media === 'boolean') {
            defaultOptions.media = options.media;
        }
    }
    return defaultOptions;
};

module.exports = (options = {}) => {
    let _this = this;
    _this.options = initOptions(options);
    _this.verifyProp = verifyPropList(_this.options.propList);
    return {
        postcssPlugin: 'postcss-unitlist',
        Declaration(decl) {
            _this.options.unitList.some(item => {
                if (item.rule.test(decl.value) && _this.verifyProp(decl.prop)) {
                    let value = replaceUnit(item.rule, item.math, item.unit, decl.value);
                    if (_this.options.replace) {
                        decl.value = value;
                    } else {
                        decl.cloneAfter({ value: value });
                    }
                    return true;
                } else {
                    return false;
                }
            });
        },
        AtRule(atRule) {
            if (_this.options.media && atRule.name === 'media') {
                _this.options.unitList.some(item => {
                    if (item.rule.test(atRule.params)) {
                        atRule.params = replaceUnit(item.rule, item.math, item.unit, atRule.params);
                        return true;
                    } else {
                        return false;
                    }
                });
            }
        },
    };
};

module.exports.postcss = true;
