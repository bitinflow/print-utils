# Print Utils

## Description

This is a [Sendcloud](https://www.sendcloud.com) compatible Print Client which runs on Windows, Linux and Mac. Its goal
is providing a simple and easy to use interface to print documents from any application to a printer connected to the
computer.

## Installation

To be done.

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

#### Response:

> On windows the response does not return any real job id. Instead, it returns a 0.

```json
{
  "jobs": [
    "1"
  ]
}
```