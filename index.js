import { getPrinters, print } from './print.js'

import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import multer from 'multer'

const app = express()
const port = 1903

const upload = multer({ dest: 'uploads/' })

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.get('/printers', async (req, res) => {
    const printers = await getPrinters()
    return res.json(printers.map(printer => {
        return {
            default: false,
            format: 'PDF',
            id: printer.printer || printer.deviceId,
            name: printer.printer || printer.name,
        }
    }))
})

app.post('/printers/:printer/print', upload.single('file'), async (req, res) => {
    const { printer } = req.params

    // query: user-id: string, docType: label
    // form data: file: binary, copies: string, shipment-ids: string

    const fileToPrint = req.file.path
    const printJob = await print(fileToPrint, printer)
    const jobId = getRequestId(printJob)

    return res.json({
        jobs: [jobId],
    })

})

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})

function getRequestId(printJob) {
    if (printJob === undefined) {
        return '0'
    }

    const requestId = printJob.stdout.split(' ')[3]
    return requestId.split('-')[1]
}