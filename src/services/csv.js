// services/csv.js - формирование CSV
// Экранирование значения: если внутри есть разделитель, кавычка или перевод строки,
// значение заключается в двойные кавычки, а кавычка внутри удваивается.
function escapeValue(value) {
    if (value === null || value === undefined) return '';

    const text = String(value);
    if (/[;"\r\n]/.test(text)) {
        return '"' + text.replace(/"/g, '""') + '"';
    }

    return text;
}

// Преобразование массива записей в CSV-строку
function toCsv(columns, rows) {
    const lines = [columns.map(escapeValue).join(';')];

    for (const row of rows) {
        lines.push(row.map(escapeValue).join(';'));
    }

    return lines.join('\r\n');
}

module.exports = { escapeValue, toCsv };
