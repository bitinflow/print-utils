# Print Utils

## Description

This is a [Sendcloud](https://www.sendcloud.com) compatible Print Client which runs on Windows, Linux and Mac. Its goal
is providing a simple and easy to use interface to print documents from any application to a printer connected to the
computer.

## Installation

### Clone the repository

```bash
git clone http://github.com/bitinflow/print-utils.git
```

### Install dependencies

```bash
npm install
```

### Install pm2

```bash
npm install pm2 -g
```

#### Set home for windows

Follow these steps:

1. Create a new folder `c:\etc\.pm2`
2. Create a new `PM2_HOME` variable (at System level, not User level) and set the value `c:\etc\.pm2`
3. Close all your open terminal windows (or restart Windows)
4. Ensure that your `PM2_HOME` has been set properly, running `echo %PM2_HOME%`

### Start the server

Start and add a process to the pm2 process list:

```bash
pm2 start index.js --name print-utils
```

Stop, start and restart a process from the process list:

```bash
pm2 stop print-utils
pm2 start print-utils
pm2 restart print-utils
```

## Usage

### List Printers

#### Request:

```bash
curl --location 'http://127.0.0.1:1903/printers'
```

#### Response:

> The `default` property is currently always `false` because the default printer is not yet supported.

```json
[
  {
    "default": false,
    "format": "PDF",
    "id": "PM-241-BT (Network)",
    "name": "PM-241-BT (Network)"
  }
]
```

### Print a PDF

#### Request:

```bash
curl --location 'http://127.0.0.1:1903/printers/PM-241-BT%20(Network)/print' \
--form 'file=@"label.pdf"' \
--form 'copies="1"'
```

#### Successful Response:

> On windows the response does not return any real job id. Instead, it returns a 0.

```json
{
  "jobs": [
    "1"
  ]
}
```

#### Error Responses:

If the request is not successful, the response will contain an error message and an error id.

```json
{
  "error": "Missing PDF file",
  "error_id": "missing_pdf"
}
```

Here is a list of possible error ids (but not all of them are implemented yet):

| Error ID      | Description                   |
|---------------|-------------------------------|
| missing_pdf   | Missing PDF file              |
| invalid_label | Invalid label format          |
| null          | Unsuccessful print job: {...} |