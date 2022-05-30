const axios = require('axios');

const API = {}
const baseURL = 'https://www.portalinmobiliario.com/';

// Axios instance configuration
const responseHandler = (response) => {
    return response.data;
    // const {
    //     data: dataResponse,
    // } = response

    
    // const { data, error, success } = dataResponse
    // // console.log('-----------data procesada', data);
    
    // if (success) {
    //     return data
    // } else {
    //     console.log('error', error)
    //     return Promise.reject(error)
    // }
}

const axiosInstance = axios.create({
    baseURL,
    validateStatus() {
        return true;
    }
})

// console.log('???????????????????', axiosInstance)

// Apply interceptors
axiosInstance.interceptors.response.use(responseHandler, (error) =>
  Promise.reject(error),
)


API.getProjectModels = ({ projectId }) =>
    axiosInstance.get(`p/api/quotations/${projectId}/modal`)

module.exports = API;