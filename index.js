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
    const { bed, bathroom, scale_up } = orderedAttr;
    const numBeds = bed ? parseInt(bed.split(" ")[0], 10) : null;
    const numBaths = bathroom ? parseInt(bathroom.split(" ")[0], 10) : null;
    const sizeRaw = scale_up ? scale_up.split(" ") : null;

    // Si no tiene 5 elementos, solo tiene 1 tamaño
    const numElements = sizeRaw.length 
    const sizeBottom = parseFloat(sizeRaw[0]);
    const sizeTop = (numElements === 5) ? parseFloat(sizeRaw[2]) : sizeBottom;

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
const orderModelUnitsInfo = ({ modelUnits, modelId, projectId }) => {
    
    try {
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
    } catch (error) {
        console.log(`Error insertando info para el project ${projectId}, model ${modelId}`);
        console.log(error);
    } 
}

// Guarda en DB la info de todos las unidades (model_units) de un modelo de dpto (model)
const saveModelUnitsInfo = async ({ projectId, modelId }) => {
    // Esta request se envía al clickear cualquier modelo de un proyecto
    const modelUnits = (await API.getModelUnits({ projectId, modelId })).components[0].model_units;
    const modelUnitsInfo = orderModelUnitsInfo({ modelUnits, modelId, projectId });

    // Guardar en DB
    const insertedUnits = await prisma.unit.createMany({
        data: modelUnitsInfo,
        skipDuplicates: true,
    })
    console.log(`Project ${projectId} | Model ${modelId} | Se insertaron ${insertedUnits.count} units`);
}

// Obtain all the model id of a projectId
const getProjectInfo = async ({ projectId, statusName }) => {

    try {
        const projectInfo = (await API.getProjectModels({ projectId })).components[0];

        // Parse info of project
        const title = projectInfo.header.text;
        const code = projectInfo.subtitle.text.split(" ")[1];
        const [ address, area ] = projectInfo.full_address.text.split(", ");
        const { models } = projectInfo;

        // Save project info to DB
        console.log(`Upserting Project ${projectId} | Code ${code} | ${title}`)
        await prisma.project.upsert({
            where: { id: projectId },
            update: { title, code, address, area, type: statusName },
            create: { id: projectId, title, code, address, area, type: statusName }
        })

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
        modelsInfo.forEach(async (model) => {
            await saveModelUnitsInfo({ projectId, modelId: model.id })
        });

    } catch (error) {
        console.log(`Error al procesar el projectId ${projectId}`);
        console.log(error)
    }

    

}

// Obtain all projectIds of a search
const getProjectIdsFromSearch = async ({ area }) => {

    // Enum de projectStatus para fácil uso
    const projectStatus = [
        { statusName: `verde`, statusCode: `5002969`},
        { statusName: `lanzamiento`, statusCode: `5002968`},
        { statusName: `entregaInmediata`, statusCode: `5002970`},
        { statusName: `prontaEntrega`, statusCode: `8039589`},
    ]

    // For every project status in that area
    for (const status of projectStatus) {
        const { statusName, statusCode } = status;
        console.log(`Starting search in area ${area}, status ${statusName}`)

        const rawHtml = (await API.getSearchPageHtml({ area, statusCode })).toString();

        // Naive with meli_ga (?)
        const initialStrSearch = `meli_ga("set", "dimension49", "`;
        const finalStrSearch = `");`;
        const initialIndex = rawHtml.indexOf(initialStrSearch) + initialStrSearch.length;
        const finalIndex = rawHtml.indexOf(finalStrSearch, initialIndex);
        const rawProjectIds = rawHtml.substring(initialIndex, finalIndex);
        const projectIds = rawProjectIds.split(",")

        // Haz la búsqueda para todos los projectId encontrados
        // Es necesario esperar porque o si no explota
        for (const projectId of projectIds) {
            await getProjectInfo({ projectId, statusName });
        }

    }

}

// For a list of areas of interest, search its projects
// Después pasar a función con argumento
const searchListOfAreas = () => {
    
    // All the areas where to search (in portal inmobiliario format)
    const areaList = [
        `nunoa-metropolitana`,
        'san-miguel-metropolitana',
    ]

    for (const area of areaList) {
        getProjectIdsFromSearch({ area });
    }
}

searchListOfAreas();