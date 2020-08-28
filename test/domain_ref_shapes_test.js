// Test the placement of Axis Referencing Objects (AROs)

var Plotly = require('../lib/index');
var d3 = require('d3');
var createGraphDiv = require('../test/jasmine/assets/create_graph_div');
var destroyGraphDiv = require('../test/jasmine/assets/destroy_graph_div');
var pixelCalc = require('../test/jasmine/assets/pixel_calc');
var getSVGElemScreenBBox = require('../test/jasmine/assets/get_svg_elem_screen_bbox');
var Lib = require('../src/lib');
var Axes = require('../src/plots/cartesian/axes');
var axisIds = require('../src/plots/cartesian/axis_ids');
var testImage = 'https://images.plot.ly/language-icons/api-home/js-logo.png';
var iterable = require('extra-iterable');

// NOTE: this tolerance is in pixels
var EQUALITY_TOLERANCE = 1e-2;

var DEBUG = true;

var it = function(s,f) {
    console.log('testing ' + s);
    f(function() { console.log(s + ' is done.'); });
}

// acts on an Object representing a aro which could be a line or a rect
// DEPRECATED
function aroFromAROPos(aro,axletter,axnum,aropos) {
    aro[axletter+'0'] = aropos.value[0];
    aro[axletter+'1'] = aropos.value[1];
    if (aropos.ref === 'range') {
        aro[axletter+'ref'] = axletter + axnum;
    } else if (aropos.ref === 'domain') {
        aro[axletter+'ref'] = axletter + axnum + ' domain';
    } else if (aropos.ref === 'paper') {
        aro[axletter+'ref'] = 'paper';
    }
}



// {axid} is the axis id, e.g., x2, y, etc.
// {ref} is ['range'|'domain'|'paper']
function makeAxRef(axid,ref) {
    var axref;
    if (ref === 'range') {
        axref = axid;
    } else if (aropos.ref === 'domain') {
        axref = axid + ' domain';
    } else if (aropos.ref === 'paper') {
        axref = 'paper';
    } else {
        throw 'Bad axis type (ref): ' + ref;
    }
    return axref;
}

// set common parameters of an ARO
// {aro} is the object whose parameters to set
// {coordletter} the letter of the coordinate to assign
// {axref} is the axis the coordinate refers to
// {value} is the value of the first coordinate (e.g., x0 if axletter is x)
function aroSetCommonParams(aro,coordletter,axref,value) {
    aro[coordletter+'0'] = value;
    aro.axref = axref;
}

// shape, annotation and image all take x0, y0, xref, yref, color parameters
// x0, y0 are numerical values, xref, yref are strings that could be passed to
// the xref field of an ANO (e.g., 'x2 domain' or 'paper'), color should be
// specified using the 'rgb(r, g, b)' syntax
// arotype can be 'shape', 'annotation', or 'image'
// shapes take type=[line|rect], x1, y1
// annotations take ax, ay, axref, ayref, (text is just set to "A" and xanchor
// and yanchor are always set to left because these are text attributes which we
// don't test)
// images take xsize, ysize, xanchor, yanchor (sizing is set to stretch for simplicity
// in computing the bounding box and source is something predetermined)
function aroFromParams(arotype,x0,y0,xref,yref,color,opts) {
    var aro = {};
    // fill with common values
    aroSetCommonParams(aro,'x',xref,x0);
    aroSetCommonParams(aro,'y',yref,y0);
    switch (arotype) {
        case 'shape':
            aro.x1 = opts.x1;
            aro.y1 = opts.y1;
            aro.type = opts.type;
            aro.line = {color: color};
        case 'annotation':
            aro.text = "A";
            aro.ax = opts.ax;
            aro.ay = opts.ay;
            aro.axref = opts.axref;
            aro.ayref = opts.ayref;
            aro.showarrow = true;
            aro.arrowhead = 0;
            aro.arrowcolor = color;
        case 'image':
            aro.sizex = opts.sizex;
            aro.sizey = opts.sizey;
            aro.xanchor = opts.xanchor;
            aro.yanchor = opts.yanchor;
            aro.sizing = "stretch";
            aro.source = testImage;
        default:
            throw "Bad arotype: " + arotype;
    }
    return aro;
}

function setAxType(layout,axref,axtype) {
    axname = axisIds.id2name(axref);
    layout[axname].type = axtype;
}

// Calculate the ax value of an annotation given a particular desired scaling K
// This also works with log axes by taking logs of each part of the sum, so that
// the length in pixels is multiplied by the scalar
function annaxscale(ac,axistype,c0,K) {
    var ret;
    if (axistype === 'log') {
        ret = Math.pow(10, Math.log10(x0) + 2 * (Math.log10(ax) - Math.log10(x0)));
    } else {
        ret = x0 + 2 * (ax - x0);
    }
    return ret;
}

// This tests to see that an annotation was drawn correctly.
// Determinining the length of the arrow seems complicated due to the
// rectangle containing the text, so we draw 2 annotations, one K times the
// length of the other, and solve for the desired arrow length from the
// length measured on the screen. This works because multiplying the length
// of the arrow doesn't change where the arrow meets the text box.
// xaxistype can be linear|log, only used if xref has type 'range' or 'domain',
// same for yaxistype and yref
function annotationTest(gd,layout,x0,y0,ax,ay,xref,yref,axref,ayref,xaxistype,yaxistype) {
    // if xref != axref or axref === 'pixel' then ax is a value relative to
    // x0 but in pixels. Same for yref
    var xreftype = Axes.getRefType(xref);
    var yreftype = Axes.getRefType(yref);
    var axpixels = false;
    var xaxname;
    var yaxname;
    if (xreftype != 'paper') {
        setAxType(layout,xref,xaxistype);
    }
    if (yreftype != 'paper') {
        setAxType(layout,yref,yaxistype);
    }
    var xpixels;
    var ypixels;
    var opts0 = {
        ax: ax,
        ay: ay,
        axref: axref,
        ayref: ayref,
    };
    var opts1 = {
        ax: axpixels ? 2 * ax : annaxscale(ax,xaxistype,x0,2),
        ay: aypixels ? 2 * ay : annaxscale(ay,yaxistype,y0,2),
        axref: axref,
        ayref: ayref,
    };
    // 2 colors so we can extract each annotation individually
    var color0 = 'rgb(10, 20, 30)';
    var color1 = 'rgb(10, 20, 31)';
    var anno0 = aroFromParams('annotation',x0,y0,xref,yref,color0,opts0);
    var anno1 = aroFromParams('annotation',x0,y0,xref,yref,color1,opts1);
    layout.annotations = [anno0,anno1];
    Plotly.relayout(gd,layout);
    // the choice of anno1 or anno0 is arbitrary
    var xabspixels = mapAROCoordToPixel(gd.layout,xref,anno1,'x0');
    var yabspixels = mapAROCoordToPixel(gd.layout,yref,anno1,'y0');
    if((axref === 'pixel') || (Axes.getRefType(axref) != xreftype)) {
        axpixels = true;
        // no need to map the specified values to pixels (because that's what
        // they are already)
        xpixels = ax;
    } else {
        axpixels = false;
        xpixels = mapAROCoordToPixel(gd.layout,xref,anno0,'ax') -
            - xabspixels;
    }
    if((ayref === 'pixel') || (Axes.getRefType(ayref) != yreftype)) {
        aypixels = true;
        // no need to map the specified values to pixels (because that's what
        // they are already)
        ypixels = ay;
    } else {
        aypixels = false;
        ypixels = mapAROCoordToPixel(gd.layout,yref,anno0,'ay') -
            - yabspixels;
    }
    var annobbox0 = getSVGElemScreenBBox(findAROByColor(color0));
    var annobbox1 = getSVGElemScreenBBox(findAROByColor(color1));
    // solve for the arrow length's x coordinate
    var arrowLenX = ((annobbox1.x+annobbox1.width) - (annobbox0.x+annobbox0.width));
    // SVG's y is the top of the box, so no need to offset by height
    var arrowLenY = annobbox1.y - annobbox0.y;
    var ret = coordsEq(arrowLenX,xpixels)
        && coordsEq(arrowLenY,ypixels)
        && coordsEq(xabspixels,annobbox0.x)
        && coordsEq(yabspixels,annobbox0.y+annobbox0.height);
    return ret;
}

// axid is e.g., 'x', 'y2' etc.
function logAxisIfAxType(layoutIn,layoutOut,axid,axtype) {
    if (axtype === 'log') {
        var axname = axisIds.id2name(axid);
        var axis = {...layoutIn[axname]};
        axis.type = 'log';
        axis.range = axis.range.map(Math.log10);
        layoutOut[axname] = axis;
    }
}

// axref can be xref or yref
// c can be x0, x1, y0, y1
// offset allows adding something to the coordinate before converting, say if
// you want to map the point on the other side of a square
function mapAROCoordToPixel(layout,axref,aro,c,offset) {
    var reftype = Axes.getRefType(aro[axref]);
    var axletter = axref[0];
    var ret;
    offset = (offset === undefined) ? 0 : offset;
    var val = aro[c] + offset;
    if (reftype === 'range') {
        var axis = axisIds.id2name(aro[axref]);
        ret = pixelCalc.mapRangeToPixel(layout, axis, val);
    } else if (reftype === 'domain') {
        var axis = axisIds.id2name(aro[axref]);
        ret = pixelCalc.mapDomainToPixel(layout, axis, val);
    } else if (reftype === 'paper') {
        var axis = axref[0];
        ret = pixelCalc.mapPaperToPixel(layout, axis, val);
    }
    return ret;
}

// compute the bounding box of the shape so that it can be compared with the SVG
// bounding box
function shapeToBBox(layout,aro) {
    var bbox = {};
    var x1;
    var y1;
    // map x coordinates
    bbox.x = mapAROCoordToPixel(layout,'xref',aro,'x0');
    x1 = mapAROCoordToPixel(layout,'xref',aro,'x1');
    // SVG bounding boxes have x,y referring to top left corner, but here we are
    // specifying aros where y0 refers to the bottom left corner like
    // Plotly.js, so we swap y0 and y1
    bbox.y = mapAROCoordToPixel(layout,'yref',aro,'y1');
    y1 = mapAROCoordToPixel(layout,'yref',aro,'y0');
    bbox.width = x1 - bbox.x;
    bbox.height = y1 - bbox.y;
    return bbox;
}

function imageToBBox(layout,img) {
    var bbox = {};
    // these will be pixels from the bottom of the plot and will be manipulated
    // below to be compatible with the SVG bounding box
    var x0;
    var x1;
    var y0;
    var y1;
    switch (img.xanchor) {
        case 'left':
            x0 = mapAROCoordToPixel(layout,'xref',img,'x');
            x1 = mapAROCoordToPixel(layout,'xref',img,'x',img.sizex);
        case 'right':
            x0 = mapAROCoordToPixel(layout,'xref',img,'x',-img.sizex);
            x1 = mapAROCoordToPixel(layout,'xref',img,'x');
        case 'center':
            x0 = mapAROCoordToPixel(layout,'xref',img,'x',-img.sizex*0.5);
            x1 = mapAROCoordToPixel(layout,'xref',img,'x',img.sizex*0.5);
        default:
            throw 'Bad xanchor: ' + img.xanchor;
    }
    switch (img.yanchor) {
        case 'bottom':
            y0 = mapAROCoordToPixel(layout,'yref',img,'y');
            y1 = mapAROCoordToPixel(layout,'yref',img,'y',img.sizey);
        case 'top':
            y0 = mapAROCoordToPixel(layout,'yref',img,'y',-img.sizey);
            y1 = mapAROCoordToPixel(layout,'yref',img,'y');
        case 'middle':
            y0 = mapAROCoordToPixel(layout,'yref',img,'y',-img.sizey*0.5);
            y1 = mapAROCoordToPixel(layout,'yref',img,'y',img.sizey*0.5);
        default:
            throw 'Bad yanchor: ' + img.yanchor;
    }
    bbox.x = x0;
    bbox.width = x1 - x0;
    // done this way because the pixel value of y1 will be smaller than the
    // pixel value x0 if y1 > y0 (because of how SVG draws relative to the top
    // of the screen)
    bbox.y = y1;
    bbox.height = y0 - y1;
    return bbox;
}


function coordsEq(a,b) {
    return Math.abs(a - b) < EQUALITY_TOLERANCE;
}

function compareBBoxes(a,b) {
    return ['x','y','width','height'].map(
            (k,)=>coordsEq(a[k],b[k])).reduce(
            (l,r)=>l&&r,
            true);
}

function findAROByColor(color) {
    var ret = d3.selectAll('path').filter(function () {
        return this.style.stroke === color;
    }).node();
    return ret;
}

function findImage() {
    var ret = d3.select('g image').node();
    return ret;
}

function checkImage(layout,imageObj,imageBBox) {
}

function imageTest(gd,layout,xaxtype,yaxtype,x,y,sizex,sizey,xanchor,yanchor,xref,yref) {
    var image = {
        x: x,
        y: y,
        sizex: sizex,
        sizey: sizey,
        source: testImage,
        xanchor: xanchor,
        yanchor: yanchor,
        xref: xref,
        yref: yref,
        sizing: "stretch"
    };
    var xreftype = Axes.getRefType(xref);
    var yreftype = Axes.getRefType(yref);
    if (xreftype != 'paper') {
        setAxType(layout,xref,xaxistype);
    }
    if (yreftype != 'paper') {
        setAxType(layout,yref,yaxistype);
    }
    layout.images=[image];
    Plotly.relayout(gd,layout);
    var imageElem = findImage();
    var svgImageBBox = getSVGElemScreenBBox(imageElem);
    var imageBBox = imageToBBox(gd.layout,image);
    var ret = compareBBoxes(svgImageBBox,imageBBox);
    return ret;
}

// gets the SVG bounding box of the aro and checks it against what mapToPixel
// gives
function checkAROPosition(gd,aro) {
    var aroPath = findAROByColor(aro.line.color);
    var aroPathBBox = getSVGElemScreenBBox(aroPath);
    var aroBBox = shapeToBBox(gd.layout,aro);
    var ret = compareBBoxes(aroBBox,aroPathBBox);
    if (DEBUG) {
        console.log('SVG BBox',aroPathBBox);
        console.log('aro BBox',aroBBox);
    }
    return ret;
}

// some made-up values for testing
var aroPositionsX = [
    {
        // aros referring to data
        ref: 'range',
        value: [2,3],
        // for objects that need a size (i.e., images)
        size: 1.5,
        // for the case when annotations specifies arrow in pixels, this value
        // is read instead of value[1]
        pixel: 50
    },
    {
        // aros referring to domains
        ref: 'domain',
        value: [0.2,0.75],
        size: 0.3,
        pixel: 60
    },
    {
        // aros referring to paper
        ref: 'paper',
        value: [0.25, 0.8],
        size: 0.35,
        pixel: 70
    },
];
var aroPositionsY = [
    {
        // aros referring to data
        ref: 'range',
        // two values for rects
        value: [1,2],
        pixel: 30,
        size: 1.2
    },
    {
        // aros referring to domains
        ref: 'domain',
        value: [0.25,0.7],
        pixel: 40,
        size: .2
    },
    {
        // aros referring to paper
        ref: 'paper',
        value: [0.2, 0.85],
        pixel: 80,
        size: .3
    }
];

var aroTypes = ['shape', 'annotation', 'image'];
var axisTypes = [ 'linear', 'log' ];
// Test on 'x', 'y', 'x2', 'y2' axes
// TODO the 'paper' position references are tested twice when once would
// suffice.
var axisPairs = [['x','y'],['x2','y'],['x','y2'],['x2','y2']];
// For annotations: if arrow coordinate is in the same coordinate system 's', if
// pixel then 'p'
var arrowAxis = [['s','s'],['p','s'],['s','p'],['p','p']];
// only test the shapes line and rect for now
var shapeType = ['line','rect'];
// anchor positions for images
var xAnchors = ['left', 'center', 'right'];
var yAnchors = ['top', 'middle', 'bottom'];
// this color chosen so it can easily be found with d3
// NOTE: for images color cannot be set but it will be the only image in the
// plot so you can use d3.select('g image').node()
var aroColor = 'rgb(50, 100, 150)';
var testDomRefAROCombo = function(combo) {
        var xAxNum    = combo[0];
        var xaxisType = combo[1];
        var xaroPos = combo[2];
        var yAxNum    = combo[3];
        var yaxisType = combo[4];
        var yaroPos = combo[5];
        var aroType = combo[6];
        it('should draw a ' + aroType
           + ' for x' + xAxNum + ' of type '
           + xaxisType
           + ' with a value referencing '
           + xaroPos.ref
           + ' and for y' + yAxNum + ' of type '
           + yaxisType
           + ' with a value referencing '
           + yaroPos.ref,
            function (done) {
                var gd = createGraphDiv();
                var mock = Lib.extendDeep({},
                        require('../test/image/mocks/domain_ref_base.json'));
                if (DEBUG) {
                    console.log(combo);
                }
                Plotly.newPlot(gd, mock)
                var aro = {
                    type: aroType,
                    line: { color: aroColor }
                };
                aroFromAROPos(aro,'x',xAxNum,xaroPos);
                aroFromAROPos(aro,'y',yAxNum,yaroPos);
                var layout = {shapes: [aro]};
                // change to log axes if need be
                logAxisIfAxType(gd.layout,layout,'x'+xAxNum,xaxisType);
                logAxisIfAxType(gd.layout,layout,'y'+yAxNum,yaxisType);
                Plotly.relayout(gd,layout);
                console.log(checkAROPosition(gd,aro));
                destroyGraphDiv();
            });
}

// Test correct aro positions
function test_correct_aro_positions () {
    // for both x and y axes
    var testCombos = [...iterable.cartesianProduct([
        axNum,axisTypes,aroPositionsX,axNum,axisTypes,aroPositionsY,aroType
    ])];
    // map all the combinations to a aro definition and check this aro is
    // placed properly
    testCombos.forEach(testDomRefAROCombo);
}

function runImageTests () {
    var testCombos = [...iterable.cartesianProduct([
        axisTypes, axisTypes, axisPairs,
        // axis reference types are contained in here
        aroPositionsX, aroPositionsY,
        xAnchors, yAnchors
    ])];
    testCombos.forEach(function(combo) {
        var axistypex = combo[0];
        var axistypey = combo[1];
        var axispair = combo[2];
        var aroposx = combo[3];
        var aroposy = combo[4];
        var xanchor = combo[5];
        var yanchor = combo[6];
        var xid = axispair[0];
        var yid = axispair[1];
        var xref = makeAxRef(xid,aroposx.ref);
        var yref = makeAxRef(yid,aroposy.ref);
        console.log([
            "Testing layout image with parameters:",
            "x-axis type:", axistypex, "\n",
            "y-axis type:", axistypey, "\n",
            "xanchor:", xanchor, "\n",
            "yanchor:", yanchor, "\n",
            "xref:", xref, "\n",
            "yref:", yref, "\n",
        ].join(' '),imageTest(gd,layout,axistypex,axistypey,
        aroposx.value[0],aroposy.value[0],aroposx.size,aroposy.size,
        xanchor,yanchor,xref,yref)
        );
    });
}

runImageTests();

