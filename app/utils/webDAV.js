const slashify = (p) => (p[p.length-1] != '/' ? `${p}/` : p)

const convertDAVNamespace = (xmlDocument) => {
    // This is used to map the DAV: namespace to urn:DAV. This is needed, because the DAV:
    // namespace is actually a violation of the XML namespaces specification, and will cause errors
    return xmlDocument.replace(/xmlns(:[A-Za-z0-9_]*)?=("|')DAV:("|')/g, "xmlns$1=$2urn:DAV$2")
}

const propsParse = (data) => {
  let props = data['D:propfind']['D:prop'][0]
  let ret = {}
  for(let prop in props){
    ret[prop] = props[prop][0]
  }
  return ret
}


class WebDAV {
  constructor(ctx){
    this._http_status = null
    this.path = null
    this.ctx = ctx
    this.davPoweredBy = null
    this.httpAuthRealm = "ShareList WebDAV"

    this.allows = ['GET','PUT','HEAD','OPTIONS','PROPFIND']
  }
  _urlencode(v){
    return decodeURIComponent(v)
  }

  mkprop(...args) {
    if (args.length == 3) {
      return {
        "ns"   : args[0], 
        "name" : args[1],
        "val"  : args[2]
      }
    } else {
      return {
        "ns"   : "DAV:", 
        "name" : args[0],
        "val"  : args[1]
      }
    }
  }

  /**
   * WebDAV If: header parsing 
   * @param  string  header string to parse
   * @param  int     current parsing position
   * @return array   next token (type and value)
   */
  _if_header_lexer(str, pos) {
      // skip whitespace
      while (/\s/.test(str.charAt(pos))) {
          ++pos
      }

      if (str.length <= pos) {
          return false;
      }

      // get next character
      let c = str.charAt(pos++)

      // now it depends on what we found
      switch (c) {
        case "<":
            // URIs are enclosed in <...>
            let pos2 = str.indexOf('>' , pos)
            let uri  = str.substr(pos, pos2 - pos)
            pos  = pos2 + 1;
            return ["URI", uri];

        case "[":
            //Etags are enclosed in [...]
            let type = 'ETAG_STRONG'
            if (str.charAt(pos) == "W") {
                type = "ETAG_WEAK";
                pos += 2;
            }
            pos2 = str.indexOf(']' , pos)
            etag = str.substr(pos + 1, pos2 - pos - 2)
            pos  = pos2 + 1
            return [ type, etag ]

        case "N":
            // "N" indicates negation
            pos += 2;
            return ["NOT", "Not"];

        default:
            // anything else is passed verbatim char by char
            return ["CHAR", c];
      }
  }

  /** 
   * parse If: header
   *
   * @param  string  header string
   * @return array   URIs and their conditions
   */
  _if_header_parser(str) {
      let pos  = 0
      let len  = str.length
      let uris = []
      let token
      // parser loop
      while (pos < len) {
          // get next token
          token = this._if_header_lexer(str, pos);

          // check for URI
          if (token[0] == "URI") {
            uri   = token[1] // remember URI
            token = this._if_header_lexer(str, pos) // get next token
          } else {
            uri = ""
          }

          // sanity check
          if (token[0] != "CHAR" || token[1] != "(") {
              return false
          }

          let list  = []
          let level = 1
          let not   = ""
          while (level) {
            token = this._if_header_lexer(str, pos)
            if (token[0] == "NOT") {
                not = "!"
                continue
            }
            switch (token[0]) {
              case "CHAR":
                  switch (token[1]) {
                    case "(":
                      level++;
                      break;
                    case ")":
                      level--;
                      break;
                    default:
                      return false;
                    }
                  break;
              case "URI":
                  list = [not+`<${token[1]}>`];
                  break;

              case "ETAG_WEAK":
                  list = [not+`[W/'${token[1]}']>`];
                  break;

              case "ETAG_STRONG":
                  list = [not+`['${token[1]}']>`];
                  break;

              default:
                  return false;
            }
            not = "";
          }

          if (uris[uri] && Array.isArray(uris[uri])) {
              uris[uri] = [].concat(uris[uri], list)
          } else {
              uris[uri] = list
          }
      }

      return uris
  }

  /**
   * check if conditions from "If:" headers are meat 
   *
   * the "If:" header is an extension to HTTP/1.1
   * defined in RFC 2518 section 9.4
   *
   * @param  void
   * @return void
   */
  _check_if_header_conditions() {
    const ctx = this.ctx
    if (ctx.get("HTTP_IF")) {
        let header_urls = this._if_header_uris = this._if_header_parser(ctx.get("HTTP_IF"))

        for( let uri in header_urls ){
          let conditions = header_urls[uri]

          if (uri == "") {
            uri = this.uri;
          }

          // all must match
          let state = true
          for(let i = 0 ; i < conditions.length ; i++){
            let condition = conditions[i]
            // lock tokens may be free form (RFC2518 6.3)
            // but if opaquelocktokens are used (RFC2518 6.4)
            // we have to check the format (litmus tests this)
            // 不相等
            if ( condition.indexOf('<opaquelocktoken') != 0 ) {
                if (!/^<opaquelocktoken:[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}>$/.test(condition)) {
                    this.http_status("423 Locked")
                    return false
                }
            }
            if (this._check_uri_condition(uri, condition)) {
                this.http_status("412 Precondition failed");
                state = false;
                break;
            }
          }

          // any match is ok
          if (state == true) {
              return true
          }
        }
        return false
    }
    return true
  }

  _get_auth(){
    let authorization = this.ctx.get('authorization')
    let [_ , value] = authorization.split(' ');
    let pairs = Buffer.from(value, "base64").toString("utf8").split(':')
    return pairs
  }

  /**
   * check authentication if check is implemented
   * 
   * @param  void
   * @return bool  true if authentication succeded or not necessary
   */
  _check_auth() {
    const ctx = this.ctx
    let auth_type = ctx.get("AUTH_TYPE") || null
    
    if( auth_type ){
      let [auth_user , auth_pw ] = this._get_auth()

      return true
    }else{
      return false
    }
    
  }

  serveRequest(ctx , next){
    this.ctx = ctx
    // default uri is the complete request uri
    let uri = ctx.protocol + "://" + ctx.hostname + ctx.pathname
    let path_info = ctx.params.path
    // just in case the path came in empty ...
    if (path_info == '') {
      path_info = "/"
    }

    this.base_uri = this.uri = uri
    // this.uri      = $uri + $path_info;

    // set path
    this.path = decodeURIComponent(path_info)

    if (!this.path) {
        if (ctx.method == "GET") {
            // redirect clients that try to GET a collection
            // WebDAV clients should never try this while
            // regular HTTP clients might ...
            this.setHeader("Location: "+$this.base_uri+"/")
            return
        } else {
            // if a WebDAV client didn't give a path we just assume '/'
            this.path = "/"
        }
    } 
    
    //magic_quotes_gpc
    // this.path = this.stripslashes(this.path)
    

    this.setHeader("X-Dav-Powered-By" , this.davPoweredBy || 'ShareList')
    

    // check authentication except options

    if ( !(ctx.method == 'OPTIONS' && this.path == "/") 
         && (this._check_auth())) {
        // RFC2518 says we must use Digest instead of Basic
        // but Microsoft Clients do not support Digest
        // and we don't support NTLM and Kerberos
        // so we are stuck with Basic here
        this.setHeader(`WWW-Authenticate: Basic realm="${this.httpAuthRealm}"`)

        // Windows seems to require this being the last header sent
        // (changed according to PECL bug #3138)
        this.http_status('401 Unauthorized')

        return
    }
    
    // check 
    if (! this._check_if_header_conditions()) {
        return;
    }
    
    // detect requested method names
    let method  = 'propfind' //this.ctx.method.toLowerCase()

    let wrapperFn = "http_"+method;
    
    // activate HEAD emulation by GET if no HEAD method found
    if (method == "head" && !this.head) {
      method = "get"
    }
    console.log( wrapperFn )
    if (
      this[wrapperFn] 
      /* && (method == "options" || this.allows.includes(method))*/
    ) {
      this[wrapperFn]()
    } 
    else { // method not found/implemented
        if (this.ctx.method == "LOCK") {
          this.http_status("412 Precondition failed")
        } 
        else {
          this.http_status("405 Method not allowed")
          this.setHeader("Allow", this.allows.join(', '));  // tell client what's allowed
        }
    }
  }


  checkAuth(type, username, password){ }


  setHeader(k , v){
    this.ctx.set(k , v)
  }

  setBody(body){
    this.ctx.type = 'text/xml; charset="utf-8"'
    this.ctx.body = body
  }

  setStatus(code){
    this.ctx.status = parseInt(code)
  }

  http_status(status) {
    // simplified success case
    if (status === true) {
      status = "200 OK"
    }
    console.log(status,'<<<<')
    let statusCode = status.split(' ')[0]
    this._http_status = status
    this.setStatus(statusCode)
    this.setHeader('X-WebDAV-Status',status)
  }

  http_options(){
    // Microsoft clients default to the Frontpage protocol 
    // unless we tell them to use WebDAV
    this.setHeader("MS-Author-Via: DAV")

    // get allowed methods
    const allows = this.allows

    // dav header
    // assume we are always dav class 1 compliant
    let dav = [1]

    if (allow.includes('LOCK')) {
      // dav class 2 requires that locking is supported 
      dav.push(2)
    }

    // tell clients what we found
    this.http_status("200 OK");
    this.setHeader("DAV: " + dav.join(', '))
    this.setHeader("Allow: " + allows.join(', '))
    this.setHeader("Content-length: 0");
  }

  /**
   * PROPFIND method handler
   *
   * @param  void
   * @return void
   */
  http_propfind() {
    const ctx = this.ctx

    let options = {
      path : this.path
    }

    console.log( ctx.request.body )

    // search depth from header (default is "infinity)
    if (ctx.get('HTTP_DEPTH')) {
      options["depth"] = ctx.get('HTTP_DEPTH')
    } else {
      options["depth"] = "infinity"
    }       

    let props = propsParse( ctx.request.body.json )
   
    options['props'] = props

    // call user handler

    let files = { "files" : [] }
    let created          = '2010-01-01';
    let modified         = '2010-01-01';
    files.files.push({
      "path"  : slashify(this.path),
      "props" : {
        displayname: this.mkprop("displayname",this.path),
        creationdate: this.mkprop("creationdate",created),
        getlastmodified: this.mkprop("getlastmodified",modified),
        resourcetype: this.mkprop("resourcetype",''),
        getcontentlength: this.mkprop("getcontentlength",0),
      }
    })

    if (files['files'].length == 0) {
        this.http_status("404 Not Found");
        return;
    }
    
    
    // collect namespaces here
    let ns_hash = [];
    
    // Microsoft Clients need this special namespace for date and time values
    let ns_defs = `xmlns:ns0="urn:uuid:c2f41010-65b3-11d1-a29f-00aa00c14882/"`;

    files.files.forEach( file => {
      let props = file.props
      for(let key in props){
        let prop = props[key]
        switch(options['props']) {
          case "all":
            // nothing to remove
            break;
          case "names":
            // only the names of all existing properties were requested
            delete props[key]["val"]
            break;
              
          default:
            let found = false;

            // search property name in requested properties 
            for(let i in options["props"]){
              if( options["props"][i]['xmlns'] ){
                options["props"][i]['xmlns'] = ''
              }
              if ( options["props"][i]['name']  == prop["name"]  &&  options["props"][i]["xmlns"] == prop["ns"]) {
                found = true;
                break;
              }
            }
            
            // unset property and continue with next one if not found/requested
            if (!found) {
              props[key]="";
              
              // 下一个file检测
              return false
            }
            break;
        }
      }

      // we also need to add empty entries for properties that were requested
      // but for which no values where returned by the user handler
      /*
      if (Array.isArray(options['props'])) {
        options["props"].froEach( reqprop => {
           // skip empty entries
          if( reqprop.name == '' ) return 
          let found = false

          if(!reqprop["xmlns"]){
            reqprop["xmlns"] = ""
          }

          // check if property exists in result
          for( let i in file["props"]){
            let prop = file["props"][i]
            if ( reqprop["name"]  == prop["name"] && reqprop["xmlns"] == prop["ns"]) {
              found = true;
              break;
            }

            if (found) {
              if (reqprop["xmlns"]==="DAV:" && reqprop["name"]==="lockdiscovery") {
                  // lockdiscovery is handled by the base class
                files["files"][$filekey]["props"][] = $this->mkprop("DAV:", 
                                      "lockdiscovery", 
                                      $this->lockdiscovery($files["files"][$filekey]['path']));
              } else {
                  // add empty value for this property
                  $files["files"][$filekey]["noprops"][] =
                      $this->mkprop($reqprop["xmlns"], $reqprop["name"], "");

                  // register property namespace if not known yet
                  if ($reqprop["xmlns"] != "DAV:" && !isset($ns_hash[$reqprop["xmlns"]])) {
                      $ns_name = "ns".(count($ns_hash) + 1);
                      $ns_hash[$reqprop["xmlns"]] = $ns_name;
                      $ns_defs .= " xmlns:$ns_name=\"$reqprop[xmlns]\"";
                  }
              }
            }
          }

        })

          foreach ($options["props"] as $reqprop) {
              if ($reqprop['name']=="") continue; // skip empty entries
              
              $found = false;
              
              if (!isset($reqprop["xmlns"])) {
                  $reqprop["xmlns"] = "";
              }

              // check if property exists in result
              foreach ($file["props"] as $prop) {
                  if (   $reqprop["name"]  == $prop["name"]
                         && $reqprop["xmlns"] == $prop["ns"]) {
                      $found = true;
                      break;
                  }
              }
              

          }
      }
      */
    })

    // now we loop over all returned file entries
    // 检查所有要返回的文件属性
 
    // 输出
    this.http_status("207 Multi-Status");
    
    let path = this.path

    let body = `<?xml version="1.0" encoding="utf-8"?>\n`
        body +=`<D:multistatus xmlns:D="DAV:">`

    files.forEach( file => {
      
    })
        body +=   `<D:response ${ns_defs}>\n`
        body +=     `<D:href>/webdav/${path}</D:href>
                     <D:propstat>
                          <D:prop xmlns:R="http://www.contoso.com/schema/">
                               <R:author>Rob Caron</R:author>
                               <R:editor>Jessup Meng</R:editor>
                               <D:creationdate>
                                  1999-11-01T17:42:21-06:30
                               </D:creationdate>
                               <D:displayname>
                                  Example Collection
                               </D:displayname>
                               <D:resourcetype><D:collection/></D:resourcetype>
                               <D:supportedlock>
                                  <D:lockentry>
                                     <D:lockscope><D:shared/></D:lockscope>
                                     <D:locktype><D:write/></D:locktype>
                                  </D:lockentry>
                               </D:supportedlock>
                            </D:prop>
                            <D:status>HTTP/1.1 200 OK</D:status>
                         </D:propstat>
                      </D:response>`
        body +=`</D:multistatus>\n`;
    this.setBody( body )
    // // ... and payload
    // echo "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
    // echo "<D:multistatus xmlns:D=\"DAV:\">\n";
        
    // foreach ($files["files"] as $file) {
    //     // ignore empty or incomplete entries
    //     if (!is_array($file) || empty($file) || !isset($file["path"])) continue;
    //     $path = $file['path'];                  
    //     if (!is_string($path) || $path==="") continue;

    //     echo " <D:response $ns_defs>\n";
    
    //     /* TODO right now the user implementation has to make sure
    //      collections end in a slash, this should be done in here
    //      by checking the resource attribute */
    //     $href = $this->_mergePaths($this->_SERVER['SCRIPT_NAME'], $path);

    //     /* minimal urlencoding is needed for the resource path */
    //     $href = $this->_urlencode($href);
    
    //     echo "  <D:href>$href</D:href>\n";
    
    //     // report all found properties and their values (if any)
    //     if (isset($file["props"]) && is_array($file["props"])) {
    //         echo "  <D:propstat>\n";
    //         echo "   <D:prop>\n";

    //         foreach ($file["props"] as $key => $prop) {
                
    //             if (!is_array($prop)) continue;
    //             if (!isset($prop["name"])) continue;
                
    //             if (!isset($prop["val"]) || $prop["val"] === "" || $prop["val"] === false) {
    //                 // empty properties (cannot use empty() for check as "0" is a legal value here)
    //                 if ($prop["ns"]=="DAV:") {
    //                     echo "     <D:$prop[name]/>\n";
    //                 } else if (!empty($prop["ns"])) {
    //                     echo "     <".$ns_hash[$prop["ns"]].":$prop[name]/>\n";
    //                 } else {
    //                     echo "     <$prop[name] xmlns=\"\"/>";
    //                 }
    //             } else if ($prop["ns"] == "DAV:") {
    //                 // some WebDAV properties need special treatment
    //                 switch ($prop["name"]) {
    //                 case "creationdate":
    //                     echo "     <D:creationdate ns0:dt=\"dateTime.tz\">"
    //                         . gmdate("Y-m-d\\TH:i:s\\Z", $prop['val'])
    //                         . "</D:creationdate>\n";
    //                     break;
    //                 case "getlastmodified":
    //                     echo "     <D:getlastmodified ns0:dt=\"dateTime.rfc1123\">"
    //                         . gmdate("D, d M Y H:i:s ", $prop['val'])
    //                         . "GMT</D:getlastmodified>\n";
    //                     break;
    //                 case "resourcetype":
    //                     echo "     <D:resourcetype><D:$prop[val]/></D:resourcetype>\n";
    //                     break;
    //                 case "supportedlock":
    //                     # (mvlcek) begin modification
    //                     if (is_array($prop['val'])) {
    //                       echo "     <D:supportedlock>";
    //                       foreach ($prop['val'] as $val) {
    //                         $parts = preg_split('/ /', $val, 2);
    //                         $lockscope = $parts[0];
    //                         $locktype = $parts[1];
    //                         echo "<D:lockentry>";
    //                         echo "<D:lockscope><D:$lockscope/></D:lockscope>";
    //                         echo "<D:locktype><D:$locktype/></D:locktype>";
    //                         echo "</D:lockentry>";
    //                       }
    //                       echo "</D:supportedlock>\n";
    //                     } else {
    //                       echo "     <D:supportedlock>$prop[val]</D:supportedlock>\n";#
    //                     }
    //                     # (mvlcek) end
    //                     break;
    //                 case "lockdiscovery":  
    //                     echo "     <D:lockdiscovery>\n";
    //                     echo $prop["val"];
    //                     echo "     </D:lockdiscovery>\n";
    //                     break;
    //                 // the following are non-standard Microsoft extensions to the DAV namespace
    //                 case "lastaccessed":
    //                     echo "     <D:lastaccessed ns0:dt=\"dateTime.rfc1123\">"
    //                         . gmdate("D, d M Y H:i:s ", $prop['val'])
    //                         . "GMT</D:lastaccessed>\n";
    //                     break;
    //                 case "ishidden":
    //                     echo "     <D:ishidden>"
    //                         . is_string($prop['val']) ? $prop['val'] : ($prop['val'] ? 'true' : 'false')
    //                         . "</D:ishidden>\n";
    //                     break;
    //                 default:                                    
    //                     echo "     <D:$prop[name]>"
    //                         . $this->_prop_encode(htmlspecialchars($prop['val']))
    //                         .     "</D:$prop[name]>\n";                               
    //                     break;
    //                 }
    //             } else {
    //                 // properties from namespaces != "DAV:" or without any namespace 
    //                 if ($prop["ns"]) {
    //                     echo "     <" . $ns_hash[$prop["ns"]] . ":$prop[name]>"
    //                         . $this->_prop_encode(htmlspecialchars($prop['val']))
    //                         . "</" . $ns_hash[$prop["ns"]] . ":$prop[name]>\n";
    //                 } else {
    //                     echo "     <$prop[name] xmlns=\"\">"
    //                         . $this->_prop_encode(htmlspecialchars($prop['val']))
    //                         . "</$prop[name]>\n";
    //                 }                               
    //             }
    //         }

    //         echo "   </D:prop>\n";
    //         echo "   <D:status>HTTP/1.1 200 OK</D:status>\n";
    //         echo "  </D:propstat>\n";
    //     }
   
    //     // now report all properties requested but not found
    //     if (isset($file["noprops"])) {
    //         echo "  <D:propstat>\n";
    //         echo "   <D:prop>\n";

    //         foreach ($file["noprops"] as $key => $prop) {
    //             if ($prop["ns"] == "DAV:") {
    //                 echo "     <D:$prop[name]/>\n";
    //             } else if ($prop["ns"] == "") {
    //                 echo "     <$prop[name] xmlns=\"\"/>\n";
    //             } else {
    //                 echo "     <" . $ns_hash[$prop["ns"]] . ":$prop[name]/>\n";
    //             }
    //         }

    //         echo "   </D:prop>\n";
    //         echo "   <D:status>HTTP/1.1 404 Not Found</D:status>\n";
    //         echo "  </D:propstat>\n";
    //     }
        
    //     echo " </D:response>\n";
    // }
    
    // echo "</D:multistatus>\n";
  }

  parsePropfindRequest(body, cbpropfindreq) {
      // If the propfind body was empty, it means IE is requesting 'all' properties
      if (!body)
          return cbpropfindreq(null, []);

      Xml.loadDOMDocument(body, this.server.options.parser, function(err, oXml) {
          //Util.log("XML ", oXml);
          if (!Util.empty(err))
              return cbpropfindreq(err);
          cbpropfindreq(null, Object.keys(Xml.parseProperties(oXml.propfind || oXml)));
      });
  }


  /**
   * COPY method handler
   *
   * @param  void
   * @return void
   */
  http_get() {
    this.ctx.body = 'hello'
  }

  /**
   * HEAD method handler
   *
   * @param  void
   * @return void
   */
  http_head() {
    
  }
}

module.exports = new WebDAV()