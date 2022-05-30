const axios = require('axios')
const { PrismaClient } = require('@prisma/client')
const API = require('./config/api')

const prisma = new PrismaClient()

// Configuration to fix prisma studio bad BigInt transformation
// JSON.stringify(
//     this,
//     (key, value) => (typeof value === 'bigint' ? value.toString() : value) // return everything else unchanged
// )

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

    // Clear size (more complex because not ordered)
    const sizeRaw = orderedAttr.scale_up.split("|")
    let totalSize, usefulSize, terraceSize;
    sizeRaw.forEach(elem => {
        const [ size, _, type ] = elem.trim().split(" ");
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
const orderModelUnitsInfo = ({ modelUnits }) => {
    // For every model_unit, get all the info
    const modelUnitsInfo = modelUnits.map((modelUnit) => {
        const unitAttr = orderModelUnitAttributes({
            attributes: modelUnit.attributes
        });
        return {
            id: modelUnit.id.toString(),
            modelId: modelUnit.model_id.toString(),
            name: modelUnit.name.text,
            pictureId: modelUnit.picture.id,
            ...unitAttr,
        }
    })

    return modelUnitsInfo;
}

// Guarda en DB la info de todos las unidades (model_units) de un modelo de dpto (model)
const saveModelUnitsInfo = async ({ projectId, modelId }) => {
    // Esta request se envía al clickear cualquier modelo de un proyecto
    const modelUnits = (await API.getModelUnits({ projectId, modelId })).components[0].model_units;
    const modelUnitsInfo = orderModelUnitsInfo({ modelUnits });

    // Guardar en DB
    const insertedUnits = await prisma.unit.createMany({
        data: modelUnitsInfo,
        skipDuplicates: true,
    })
    console.log(`Project ${projectId} | Model ${modelId} | Se insertaron ${insertedUnits.count} units`);
}

// Obtain all the model id of a projectId
const getProjectInfo = async ({ projectId }) => {
    const projectInfo = (await API.getProjectModels({ projectId })).components[0];

    // Parse info of project
    const title = projectInfo.header.text;
    const code = projectInfo.subtitle.text.split(" ")[1];
    const address = projectInfo.full_address.text;
    const { models } = projectInfo;

    // Save project info to DB
    const upsertedProject = await prisma.project.upsert({
        where: { id: projectId },
        update: { title, code },
        create: { id: projectId, title, code, address }
    })
    console.log(`Upserted Project ${projectId} | Code ${code} | ${title}`)

    // Obtain data about the models
    const modelsInfo = models.map((model) => {
        // Obtain model attributes
        const modelAttrs = orderModelAttributes({
            attributes: model.attributes
        })
        return {
            id: model.id.toString(),
            projectId,
            picture: model.picture.id,
            ...modelAttrs,
        }
    })

    // Insert models data into DB
    const insertedModels = await prisma.model.createMany({
        data: modelsInfo,
        skipDuplicates: true,
    })
    console.log(`Project ${projectId} | Se insertaron ${insertedModels.count} models`)

    // For every model, save its unit Info in DB
    modelsInfo.forEach(model => {
        saveModelUnitsInfo({ projectId, modelId: model.id })
    });

}

getProjectInfo({ projectId: 'MLC535323359' });