import globalAxiosClient, { printAxiosClient } from '@/utils/axios'
import store from '@/store/store.js'

import Segment from '@/app/users/tracking/segment.js'
import i18n from '@/i18n/i18n'
import serializeUrlParams from '@/utils/serialize-url-params.js'
import ClientHelperService from '@/services/client-helper.service.js'
import ModalService from '@/services/modal.service.js'
import { getAbsoluteBackendURL } from '@/utils/backend'
import * as DownloadsApi from '../api/downloads.api.js'

import ToastService from '@/services/toast.service'

export default {
    printers: undefined,

    /**
     * Opens a new window to download the document, or the current window URL
     * is changed to display the PDF
     *
     * @param {string} url URL where the document can be downloaded
     * @param {Object} params An `Object` of key/value pairs to be turned into a query string
     * @param {string} [fileName] File name to save as
     * @return {Promise<void>}
     */
    _downloadDocument(url, params = {}, fileName) {
        // The URL passed is a relative one, with the frontend running on
        // app.sendcloud.com and the document generating endpoints over at
        // eu-central-1-0.app.sendcloud.com, we need to make this URL absolute.
        const absoluteUrl = getAbsoluteBackendURL(url)
        const queryString = serializeUrlParams({ ...params, download: true })
        return DownloadsApi.push(new URL(`${absoluteUrl}?${queryString}`), fileName)
    },

    /**
     * @param {string} printerId
     * @param {string} doc File contents
     * @param {string} docType Document type
     * @param {{ numberOfCopies?: number
     *         , shipmentIds?: Array<number>
     *         }} [options={}]
     * @returns {Promise} Rejected promise if the browser is unsupported, otherwise a resolved
     * Promise with the result from the endpoint
     */
    _printDocument(printerId, doc, docType, options = {}) {
        const { numberOfCopies = 1, shipmentIds = [] } = options
        if (!ClientHelperService.isBrowserSupported()) {
            // eslint-disable-next-line prefer-promise-reject-errors
            return Promise.reject({
                printer: printerId,
                data: doc,
                reason: 'unsupported_browser',
            })
        }

        const API_URL = store.getters.definitions.desktop_client.api_url
        const user = store.getters.user

        const payload = new FormData()
        const blob = new Blob([doc], { type: 'application/pdf' })
        payload.append('file', blob)
        payload.append('copies', numberOfCopies.toString())
        payload.append('shipment-ids', shipmentIds.join(','))

        const config = {
            params: { 'user-id': user.id, 'docType': docType },
        }

        return printAxiosClient.post(`${API_URL}/printers/${encodeURIComponent(printerId)}/print`, payload, config)
    },

    /**
     * Download customs documents to the user's device, either in a new window or the current window.
     *
     * @param {Array<number>} shipmentIds List of shipment IDs
     * @param {Object} printFormat `Object` containing paper size of the document
     * @returns {Promise<void>}
     */
    downloadCustomsDocuments(shipmentIds, printFormat) {
        const params = {
            ids: shipmentIds.join(','),
            start_from: printFormat.startAt,
            paper_size: printFormat.size || 'A4',
            type: 'customs',
        }

        return this._downloadDocument('/xhr/parcel/label', params, 'customs')
    },

    /**
     * Download labels to the user's device, either in a new window or the current window,
     * using the user's selected print options.
     *
     * @param {Array} shipmentIds List of shipment blob UUIDs
     * @param {Object} printFormat `Object` containing paper size and where on the page to start printing labels
     */
    downloadLabels(shipmentIds, printFormat) {
        if (store.getters.user.is_account_on_hold) {
            return this.showAccountOnHoldModal()
        }

        const params = {
            ids: shipmentIds.join(','),
            start_from: printFormat.startAt,
            paper_size: printFormat.size,
        }

        this._downloadDocument('/xhr/parcel/label', params, 'labels')
    },

    /**
     * Download packing slips to the user's device, either in a new window or the current window.
     *
     * @param {Array<string>} shipmentBlobUuids List of shipment blob UUIDs
     * @param {Object} _printFormat (Currently unused) Object containing paper size and document position
     * @param {number} senderAddressId
     */
    downloadPackingSlips(shipmentBlobUuids, _printFormat, senderAddressId) {
        this._downloadDocument(
            '/orders/packgo/slips/packing-slip',
            {
                blobs: shipmentBlobUuids.join(','),
                sender_address: senderAddressId,
            },
            'packing_slip',
        )
    },

    /**
     * Download picking lists to the user's device, either in a new window or the current window.
     *
     * @param {Array<string>} shipmentBlobUuids List of shipment blob UUIDs
     * @param {Object} _printFormat (Currently unused) Object containing paper size and document position
     */
    downloadPickingLists(shipmentBlobUuids, _printFormat) {
        this._downloadDocument(
            '/orders/packgo/slips/picking-list',
            {
                blobs: shipmentBlobUuids.join(','),
            },
            'picking_list',
        )
    },

    /**
     * Check if a printer exists in the service's stored list of printers.
     *
     * @param {string} printerId
     * @returns {boolean} `true` if a printer with a matching `id` is found, otherwise `false`.
     */
    exists(printerId) {
        if (!Array.isArray(this.printers) || !printerId) {
            return false
        }

        const foundPrinter = this.printers.find(printer => printer.id === printerId)
        return foundPrinter !== undefined && foundPrinter !== null
    },

    /**
     * Fetch printers and store them in the service for future reference.
     *
     * @returns {Promise} An empty `Array` if the browser is not supported, an `Array`
     * of printer `Object`s installed on the user's device, or `undefined` in case of failure.
     */
    async findAll() {
        if (!ClientHelperService.isBrowserSupported()) {
            this.printers = []
            return Promise.resolve([])
        }

        try {
            const API_URL = store.getters.definitions.desktop_client.api_url
            const user = store.getters.user

            const { data: printers } = await printAxiosClient.get(`${API_URL}/printers`, {
                params: { 'user-id': user.id },
            })
            this.printers = printers
            return Promise.resolve(printers)
        } catch (error) {
            this.printers = undefined
            return Promise.resolve(undefined)
        }
    },

    /**
     * List printers that are stored in the service.
     *
     * @returns {Promise<Array|undefined>} An empty `Array` if the browser is not supported, an `Array`
     * of printer `Object`s installed on the user's device, or `undefined` in case of failure. Will be `undefined`
     * if the `findAll()` method has not previously been called.
     */
    async getAll() {
        // TODO: Remove this condition after the full FE/BE split
        if (!this.printers) {
            await this.findAll()
        }
        return this.printers
    },

    /**
     * Retrieve the default printer from the provided `printers` argument.
     *
     * @param {Array|undefined} printers A list of printers to inspect
     * @returns {Object|undefined} The user's default printer `Object`, if available - otherwise `undefined`
     */
    getDefault(printers) {
        if (!Array.isArray(printers)) {
            return undefined
        }
        return printers.find(printer => printer.default === true)
    },

    /**
     * Print customs documents with the user's selected printer and print options.
     *
     * @param {Array<number>} shipmentIds List of shipment IDs
     * @param {string} printerId
     * @param {Object} printFormat `Object` containing paper size definition and where
     * @param {number} numberOfCopies
     */
    async printCustomsDocuments(shipmentIds, printerId, printFormat, numberOfCopies = 1) {
        const params = {
            ids: shipmentIds.join(','),
            start_from: printFormat.start_from || 0,
            paper_size: printFormat.size || 'A4',
            download: false,
            type: 'customs',
        }

        const { data } = await globalAxiosClient.get('/xhr/parcel/label', { responseType: 'arraybuffer', params })
        await this._printDocument(printerId, data, 'customs', {
            numberOfCopies,
            shipmentIds,
        })
    },

    /**
     * Print labels with the user's selected printer and print options
     *
     * @param {Array<number>} shipmentIds List of shipment IDs
     * @param {string} printerId
     * @param {Object} printFormat `Object` containing paper size definition and where
     * on the page to start printing labels
     */
    printLabels(shipmentIds, printerId, printFormat) {
        if (store.getters.user.is_account_on_hold) {
            return this.showAccountOnHoldModal()
        }

        const params = {
            ids: shipmentIds.join(','),
            start_from: printFormat.startAt || 0,
            paper_size: printFormat.size || 'A6',
            download: false,
        }

        return globalAxiosClient
            .get('/xhr/parcel/label', { responseType: 'arraybuffer', params })
            .then((response) => {
                return this._printDocument(printerId, response.data, 'label', { shipmentIds })
            })
            .catch((error) => {
                if (error.errors && error.errors[0].detail) {
                    for (const err of error.errors) {
                        ToastService.error(err.detail)
                    }
                }
            })
    },

    /**
     * Print packing slips with the user's selected printer
     *
     * @param {Array<string>} shipmentBlobUuids List of shipment blob UUIDs
     * @param {string} printerId
     * @param {Object} _printFormat (Currently unused) `Object` containing paper size definition and where
     * on the page to start printing documents
     * @param {number} senderAddressId
     */
    async printPackingSlips(shipmentBlobUuids, printerId, _printFormat, senderAddressId) {
        const url = `/orders/packgo/slips/packing-slip?sender_address=${senderAddressId}&blobs=${shipmentBlobUuids.join(
            ',',
        )}`

        const { data } = await globalAxiosClient.get(url, { responseType: 'arraybuffer' })
        return this._printDocument(printerId, data, 'packing-slip', { shipmentIds: shipmentBlobUuids })
    },

    /**
     * Print picking lists with the user's selected printer
     *
     * @param {Array<string>} shipmentBlobUuids List of shipment blob UUIDs
     * @param {string} printerId
     * @param {Object} _printFormat (Currently unused) `Object` containing paper size definition and where
     * on the page to start printing documents
     */
    async printPickingLists(shipmentBlobUuids, printerId, _printFormat) {
        const url = `/orders/packgo/slips/picking-list?blobs=${shipmentBlobUuids.join(',')}`

        try {
            const { data } = await globalAxiosClient.get(url, { responseType: 'arraybuffer' })
            const result = await this._printDocument(printerId, data, 'picking-list', { shipmentIds: shipmentBlobUuids })
            return Promise.resolve(result)
        } catch (error) {
            // Reject with the URL (the caller may use it as a fallback, retry, etc):
            return Promise.reject(url)
        }
    },

    /**
     * Displays a confirmation modal explaining the user that printing labels is unavailable due to the
     * account being on hold.
     *
     * @returns {Promise<void>}
     */
    async showAccountOnHoldModal() {
        Segment.track('Print Labels on Hold modal')

        return new Promise((_resolve, reject) => {
            ModalService.build('AccountOnHoldModal', {
                id: 'account-on-hold',
                confirm: () => {
                    reject()
                },
                title: `${i18n.t("Sorry! You can't print any labels right now.")} 😕`,
                bodyMessage: `<p>${i18n.t(
                    "We've placed your account on hold in order to review it for security reasons. This means you can't create or print any labels at this time.",
                )}</p>
          <p>${i18n.t("Don't worry—these reviews are usually finished within a few hours on normal business days.")}</p>
          <p>${i18n.t(
                    'If you have any concerns in the meantime, feel free to reach out to our customer support team.',
                )}</p>`,
            })
        })
    },
}
