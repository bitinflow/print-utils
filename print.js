import { platform } from 'os';
import * as windowsMethods from 'pdf-to-printer';
import * as linuxMethods from 'unix-print';

let methods;

if (platform() === 'win32') {
    methods = windowsMethods.default;
} else {
    methods = linuxMethods.default;
}

export const print = async (file, printer) => {
    if (platform() === 'win32') {
        return await methods.print(file, {printer});
    }

    return await methods.print(file, printer);
}

export const getPrinters = async () => {
    return await methods.getPrinters();
}