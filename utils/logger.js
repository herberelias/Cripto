/**
 * Sistema de Logging Profesional
 * Niveles: DEBUG, INFO, WARN, ERROR
 */

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    // Colores de texto
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    // Colores de fondo
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m'
};

const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

const levels = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

function shouldLog(level) {
    return levels[level] >= levels[LOG_LEVEL];
}

function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function debug(message, data = null) {
    if (!shouldLog('DEBUG')) return;
    console.log(`${colors.dim}[${getTimestamp()}] ${colors.cyan}DEBUG${colors.reset} ${message}`);
    if (data) console.log(colors.dim, data, colors.reset);
}

function info(message, data = null) {
    if (!shouldLog('INFO')) return;
    console.log(`${colors.dim}[${getTimestamp()}]${colors.reset} ${colors.blue}INFO${colors.reset}  ${message}`);
    if (data) console.log(data);
}

function success(message, data = null) {
    if (!shouldLog('INFO')) return;
    console.log(`${colors.dim}[${getTimestamp()}]${colors.reset} ${colors.green}✓${colors.reset}     ${message}`);
    if (data) console.log(data);
}

function warn(message, data = null) {
    if (!shouldLog('WARN')) return;
    console.log(`${colors.dim}[${getTimestamp()}]${colors.reset} ${colors.yellow}WARN${colors.reset}  ${message}`);
    if (data) console.log(colors.yellow, data, colors.reset);
}

function error(message, err = null) {
    if (!shouldLog('ERROR')) return;
    console.log(`${colors.dim}[${getTimestamp()}]${colors.reset} ${colors.red}ERROR${colors.reset} ${message}`);
    if (err) {
        if (err.stack) {
            console.log(colors.red, err.stack, colors.reset);
        } else {
            console.log(colors.red, err, colors.reset);
        }
    }
}

function senal(tipo, message, data = null) {
    const emoji = tipo === 'LONG' ? '📈' : '📉';
    const color = tipo === 'LONG' ? colors.green : colors.red;
    console.log(`${colors.dim}[${getTimestamp()}]${colors.reset} ${color}${emoji} ${tipo}${colors.reset} ${message}`);
    if (data) console.log(data);
}

function trade(tipo, resultado, message, data = null) {
    const emoji = resultado === 'ganancia' ? '✅' : '❌';
    const color = resultado === 'ganancia' ? colors.green : colors.red;
    console.log(`${colors.dim}[${getTimestamp()}]${colors.reset} ${color}${emoji} ${tipo}${colors.reset} ${message}`);
    if (data) console.log(data);
}

function section(title) {
    console.log('\n' + colors.bright + colors.cyan + '═'.repeat(60) + colors.reset);
    console.log(colors.bright + colors.cyan + ` ${title}` + colors.reset);
    console.log(colors.bright + colors.cyan + '═'.repeat(60) + colors.reset + '\n');
}

function subsection(title) {
    console.log('\n' + colors.dim + '─'.repeat(60) + colors.reset);
    console.log(colors.bright + ` ${title}` + colors.reset);
    console.log(colors.dim + '─'.repeat(60) + colors.reset);
}

module.exports = {
    debug,
    info,
    success,
    warn,
    error,
    senal,
    trade,
    section,
    subsection
};
