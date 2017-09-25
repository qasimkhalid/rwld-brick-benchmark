//
// Serves writeable ssn:Properties on a REST interface
//
// Author: kaefer3000
//

// Load the web framework
var express = require('express');
// Load the logger for the web framework
var logger = require('morgan');
// Load some parsers for HTTP message bodys
var bodyParser = require('body-parser');
// Load RDF
var rdf = require('rdf-ext')
// Load the RDF parsers for HTTP messages
var rdfBodyParser = require('rdf-body-parser');
var RdfXmlSerializer = require('rdf-serializer-rdfxml');
// Load CLI parser
var minimist = require('minimist');
// The root app
var app = express();

// Preparing to use my rdf/xml serialiser
var formatparams = {};
formatparams.serializers = new rdf.Serializers();
formatparams.serializers['application/rdf+xml'] = RdfXmlSerializer;
var formats = require('rdf-formats-common')(formatparams);

var configuredBodyParser = rdfBodyParser({'defaultMediaType' : 'text/turtle', 'formats' : formats});

var argv = minimist(process.argv.slice(2));

// Reading CLI
var resourceInOnState = {};
for (thing in argv._) {
  resourceInOnState[argv._[thing]] = false;
}

// configuring the app
app.set('case sensitive routing', true);
app.set('strict routing', true);
//app.use(logger('dev'));
app.use(configuredBodyParser);


// On root, we serve an overview
var rootGraph = rdf.createGraph();
for (resource in resourceInOnState) {
  rootGraph.add(
    new rdf.Triple(
      new rdf.NamedNode(''),
      new rdf.NamedNode('http://www.w3.org/2000/01/rdf-schema#seeAlso'),
      new rdf.NamedNode(resource)
    )
  );
}
app.get('/', function(request, response) {
  response.sendGraph(rootGraph);
});

// basic graph for all resources but root
var propertyBaseGraph = rdf.createGraph();
propertyBaseGraph.addAll(
  [
    new rdf.Triple(
      new rdf.NamedNode('#it'),
      new rdf.NamedNode('http://xmlns.com/foaf/0.1/isPrimaryTopicOf'),
      new rdf.NamedNode('')),
    new rdf.Triple(
      new rdf.NamedNode('#it'),
      new rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new rdf.NamedNode('http://www.w3.org/ns/ssn/Property')),
    new rdf.Triple(
      new rdf.NamedNode('#it'),
      new rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new rdf.NamedNode('http://www.w3.org/ns/sosa/ActuableProperty')),
    new rdf.Triple(
      new rdf.NamedNode('#it'),
      new rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      new rdf.NamedNode('http://www.w3.org/ns/sosa/ObservableProperty'))
  ])
var onTriple = new rdf.Triple(
                      new rdf.NamedNode('#it'),
                      new rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#value'),
                      new rdf.NamedNode('https://w3id.org/saref#On'));
var offTriple = new rdf.Triple(
                      new rdf.NamedNode('#it'),
                      new rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#value'),
                      new rdf.NamedNode('https://w3id.org/saref#Off'));

var propertyBaseGraphOn = propertyBaseGraph.merge([onTriple]);
var propertyBaseGraphOff = propertyBaseGraph.merge([offTriple]);

app.route("/:id").get(function(request, response) {

  var id = request.params.id;
  if (! id in resourceInOnState)
    response.sendStatus(404);

  if (resourceInOnState[id])
    response.sendGraph(propertyBaseGraphOn);
  else
    response.sendGraph(propertyBaseGraphOff);
});

app.route("/:id").put(function(request, response) {

  var id = request.params.id;
  if (! id in resourceInOnState)
    response.sendStatus(404);

  var statetriple;
  var targetStateTripleCount = 0;
  request.graph.filter(
    function(triple) {
      return triple.predicate.nominalValue === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#value'
    }).forEach(function(triple) {
      ++targetStateTripleCount;
      statetriple = triple;
    });
  if (targetStateTripleCount === 0 || targetStateTripleCount > 1) {
    response.status(400);
    response.send('Please supply exactly one triple with desired state\n');
    return;
  }

  var targetState;
  if (statetriple.object.interfaceName === 'NamedNode') {
    switch (statetriple.object.nominalValue) {
      case "https://w3id.org/saref#On":
        targetState = true;
        break;
      case "https://w3id.org/saref#Off":
        targetState = false;
        break;
      default:
        response.status(400);
        response.send('Please supply a triple with rdf:value as predicate and saref:Off or saref:On as object\n');
        return;
      }
  } else {
    response.status(400);
    response.send('Please supply a triple with rdf:value as predicate and saref:Off or saref:On as object\n');
    return;
  }
  response.sendStatus(204);
});


// Startup the server
var port = 8080;
app.listen(port, function () {
  console.log('SSN Property REST app listening on port ' + port);
});

// For finding the server in the network, some handy output on the console
console.log(require('os').networkInterfaces());

