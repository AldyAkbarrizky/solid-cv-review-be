const pdf = require('pdf-parse');
console.log('Type of export:', typeof pdf);
console.log('Export keys:', Object.keys(pdf));
console.log('Is constructor?', typeof pdf === 'function' && pdf.prototype && pdf.prototype.constructor === pdf);
if (typeof pdf === 'object') {
    console.log('Check for PDFParse property:', pdf.PDFParse);
}
