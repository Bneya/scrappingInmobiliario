const axios = require('axios');

const API = {}
const baseURL = 'https://www.portalinmobiliario.com/';

// Axios instance configuration
const responseHandler = (response) => {
    return response.data;
}

const axiosInstance = axios.create({
    baseURL,
    validateStatus() {
        return true;
    }
})

// Apply interceptors
axiosInstance.interceptors.response.use(responseHandler, (error) =>
  Promise.reject(error),
)


API.getProjectModels = ({ projectId }) =>
    axiosInstance.get(`p/api/quotations/${projectId}/modal`)
API.getModelUnits = ({ projectId, modelId }) =>
    axiosInstance.get(`p/api/quotations/${projectId}/modal?model_id=${modelId}`)
API.getSearchPageHtml = ({ area, statusCode }) =>
    axiosInstance.get(`venta/departamento/proyectos/${area}/_DEVELOPMENT*STATUS_${statusCode}`)

module.exports = API;