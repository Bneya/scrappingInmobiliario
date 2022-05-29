const axios = require('axios')

const orderModelUnitAttributes = ({ attributes }) => {
    const orderedAttr = {};
    attributes.forEach(attr => {
        const attrType = attr.icon.id.toLowerCase();
        const attrValue = attr.label.text;
        orderedAttr[attrType] = attrValue;
    });

    console.log('orderedAttr', orderedAttr)

    // Clear attributes
    const numBeds = orderedAttr.bed.split(" ")[0];
    const numBaths = orderedAttr.bathroom.split(" ")[0];
    const floor = orderedAttr.unit_floor.split(" ")[1];
    const orientation = orderedAttr.facing;

    // Clear size (more complex because not ordered)
    const sizeRaw = orderedAttr.scale_up.split("|")
    let totalSize, usefulSize, terraceSize;
    sizeRaw.forEach(elem => {
        const [ size, _, type ] = elem.trim().split(" ");
        // console.log('size, m2, type', size, _, type);
        

        switch (type) {
            case 'totales':
                totalSize = size
            case 'útiles':
                usefulSize = size
            case 'terraza':
                terraceSize = size
        }
    });
    // console.log("total, useful, terrace", total, useful, terrace)

    // console.log('numBeds', numBeds);
    // console.log('numBaths', numBaths);
    // console.log('floor', floor);
    // console.log('orientation', orientation);
    // console.log('size', sizeRaw)

    return {
        numBeds,
        numBaths,
        totalSize,
        usefulSize,
        terraceSize,
        floor,
        orientation,
    }

}

const orderModelUnitsInfo = ({ modelUnits }) => {
    // For every model_unit, get all the info
    const modelUnitsinfo = modelUnits.map((modelUnit) => {
        const unitAttr = orderModelUnitAttributes({
            attributes: modelUnit.attributes
        });
        return {
            id: modelUnit.id,
            modelId: modelUnit.model_id,
            name: modelUnit.name.text,
            // size: modelUnit.description.text,
            pictureId: modelUnit.picture.id,
            ...unitAttr,
        }
    })

    console.log(modelUnitsinfo);
}

// Obtiene la info de todos las unidades (model_units) de un tipo de dpto (model)
const getAptInfo = async () => {
    // Esta request se envía al clickear cualquier modelo de un proyecto
    const infoRaw = (await axios.get('https://www.portalinmobiliario.com/p/api/quotations/MLC587164941/modal?app=vip&model_id=174566204663')).data.components[0];
    console.log(infoRaw);

    // Componentes
    const projectTitle = infoRaw.header.text;
    const code = infoRaw.subtitle.text;
    const address = infoRaw.full_address.text;
    const { models, model_units } = infoRaw;
    console.log('projectTitle', projectTitle);
    console.log('code', code);
    console.log('address', address);
    console.log('models', models);
    console.log('model_units', model_units);

    orderModelUnitsInfo({ modelUnits: model_units })

}

getAptInfo();