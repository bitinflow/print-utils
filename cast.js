import dgram from 'dgram'
import { getPrinters } from './print.js'

export function discover() {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    const origin = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const discoveredPrinters = []
    const discoverInterval = 10000
    const timeoutInterval = 30000

    const broadcast = (event, payload) => {
        socket.send(Buffer.from(JSON.stringify({
            event,
            origin,
            ...payload,
        })), 4446, '230.0.0.0', function (err) {
            if (err) console.error(err)
        })
    }

    socket.bind(4446, function () {
        socket.addMembership('230.0.0.0')
    })

    socket.on('listening', function () {
        console.log('UDP Socket listening on ' + JSON.stringify(socket.address()))
    })

    socket.on('message', async function (message, rinfo) {
        console.log(`Received message: ${message} from ${rinfo.address}:${rinfo.port}`)
        try {
            const payload = JSON.parse(message.toString())
            if (payload.event === 'printer-list') {
                const printers = await getPrinters()

                printers.map(printer => {
                    broadcast('printer', {
                        printer: {
                            default: false,
                            format: 'PDF',
                            id: printer.printer || printer.deviceId,
                            name: printer.printer || printer.name,
                        },
                    })
                })
            } else if (payload.event === 'printer') {
                console.log('Printer list received')
                const { printer } = payload
                const existingPrinter = discoveredPrinters.find(p => p.id === printer.id)
                const last_seen = new Date().getTime()

                if (existingPrinter) {
                    existingPrinter.last_seen = last_seen
                } else {
                    discoveredPrinters.push({
                        ...printer,
                        uri: `http://${rinfo.address}/printers/${encodeURIComponent(printer.id)}/print`,
                        last_seen,
                    })
                }
            }
        } catch (e) {
            console.log('Error parsing message', e)
        }
    })

    // Your list
    let list = [{ origin, port: 1903 }]

    // Serialize the list to JSON
    let jsonList = JSON.stringify(list)

    setInterval(() => broadcast('printer-list'), discoverInterval)
    broadcast('printer-list')

    setInterval(() => {
        const now = new Date().getTime()
        discoveredPrinters.forEach(printer => {
            if (now - printer.last_seen > timeoutInterval) {
                const index = discoveredPrinters.indexOf(printer)
                discoveredPrinters.splice(index, 1)
            }
        })
        console.log('Discovered printers', discoveredPrinters)
    }, 5000)

    return {
        printers: list,
    }
}

discover()