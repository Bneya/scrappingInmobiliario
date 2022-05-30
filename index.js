const axios = require('axios')
const { PrismaClient } = require('@prisma/client')
const API = require('./config/api')

const prisma = new PrismaClient()


// Order attributes of 1 model
const orderModelAttributes = ({ attributes }) => {
    const orderedAttr = {};
    attributes.forEach(attr => {
        const attrType = attr.icon.id.toLowerCase();
        const attrValue = attr.label.text;
        orderedAttr[attrType] = attrValue;
    });

    // Clear attributes
    const numBeds = parseInt(orderedAttr.bed.split(" ")[0], 10);
    const numBaths = parseInt(orderedAttr.bathroom.split(" ")[0], 10);
    const sizeRaw = orderedAttr.scale_up.split(" ");
    const sizeBottom = parseFloat(sizeRaw[0]);
    const sizeTop = parseFloat(sizeRaw[2]);

    // console.log(orderedAttr);
    return {
        numBeds,
        numBaths,
        sizeBottom,
        sizeTop,
    }
}


// Order attributes of 1 model_unit
const orderModelUnitAttributes = ({ attributes }) => {
    const orderedAttr = {};
    attributes.forEach(attr => {
        const attrType = attr.icon.id.toLowerCase();
        const attrValue = attr.label.text;
        orderedAttr[attrType] = attrValue;
    });

    // Clear attributes
    const { bed, bathroom, unit_floor } = orderedAttr;
    const numBeds = bed ? parseInt(bed.split(" ")[0], 10) : null;
    const numBaths = bathroom ? parseInt(bathroom.split(" ")[0], 10) : null;
    const floor = unit_floor ? parseInt(unit_floor.split(" ")[1], 10) : null;
    const orientation = orderedAttr.facing;
    console.log("-------flooooooooor", floor)

    // Clear size (more complex because not ordered)
    const sizeRaw = orderedAttr.scale_up.split("|")
    let totalSize, usefulSize, terraceSize;
    sizeRaw.forEach(elem => {
        const [ size, _, type ] = elem.trim().split(" ");
        // console.log('size, m2, type', size, _, type);
        switch (type) {
            case 'totales':
                totalSize = parseFloat(size)
            case 'útiles':
                usefulSize = parseFloat(size)
            case 'terraza':
                terraceSize = parseFloat(size)
        }
    });

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

// Order all model_units info
const orderModelUnitsInfo = async ({ modelUnits }) => {
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

    // modelUnitsinfo[0].name = 'aaaaaaamodificadooooooo'
    // console.log(modelUnitsinfo);

    // Guardar en DB
    const upsertedUnits = await prisma.unit.createMany({
        data: modelUnitsinfo,
        skipDuplicates: true,
    })
    console.log('upsertedUnits', upsertedUnits)

}

// Obtiene la info de todos las unidades (model_units) de un tipo de dpto (model)
const getAptInfo = async () => {
    // Esta request se envía al clickear cualquier modelo de un proyecto
    const infoRaw = (await axios.get('https://www.portalinmobiliario.com/p/api/quotations/MLC535323359/modal?model_id=174476202465')).data.components[0];
    // console.log(infoRaw);

    // Componentes
    const projectTitle = infoRaw.header.text;
    const code = infoRaw.subtitle.text;
    const address = infoRaw.full_address.text;
    const { models, model_units } = infoRaw;
    console.log('projectTitle', projectTitle);
    console.log('code', code);
    console.log('address', address);
    console.log('models', models);
    // console.log('model_units', model_units);

    orderModelUnitsInfo({ modelUnits: model_units })

}

// Obtain all the model id of a projectId
const getProjectInfo = async ({ projectId }) => {
    const projectInfo = (await API.getProjectModels({ projectId })).components[0];

    // Parse info of project
    const title = projectInfo.header.text;
    const code = projectInfo.subtitle.text;
    const address = projectInfo.full_address.text;
    const { models } = projectInfo;

    // Save project info to DB
    const upsertedProject = await prisma.project.upsert({
        where: { id: projectId },
        update: { title },
        create: { id: projectId, title, code, address }
    })
    console.log('upsertedProject', upsertedProject)

    // Obtain data about the models
    const modelsInfo = models.map((model) => {
        // Parte model attributes
        const modelAttrs = orderModelAttributes({
            attributes: model.attributes
        })
        return {
            id: model.id,
            projectId,
            picture: model.picture.id,
            ...modelAttrs,
        }
    })

    console.log('modelsInfo', modelsInfo);

    // Insert models data into DB
    await prisma.model.createMany({
        data: modelsInfo,
        skipDuplicates: true,
    })
}


getAptInfo();
getProjectInfo({ projectId: 'MLC535323359' });