from xml.etree import ElementTree
from Tea.model import TeaModel
from Tea.exceptions import RequiredArgumentException
from collections import defaultdict


class Client:
    _LIST_TYPE = (list, tuple, set)

    @staticmethod
    def __get_xml_factory(elem, val, parent_element=None):
        if val is None:
            return

        if isinstance(val, dict):
            Client.__get_xml_by_dict(elem, val)
        elif isinstance(val, Client._LIST_TYPE):
            if parent_element is None:
                raise RequiredArgumentException("Missing root tag")
            Client.__get_xml_by_list(elem, val, parent_element)
        else:
            elem.text = str(val)

    @staticmethod
    def __get_xml_by_dict(elem, val):
        for k in val:
            sub_elem = ElementTree.SubElement(elem, k)
            Client.__get_xml_factory(sub_elem, val[k], elem)

    @staticmethod
    def __get_xml_by_list(elem, val, parent_element):
        i = 0
        tag_name = elem.tag
        if val.__len__() > 0:
            Client.__get_xml_factory(elem, val[0], parent_element)

        for item in val:
            if i > 0:
                sub_elem = ElementTree.SubElement(parent_element, tag_name)
                Client.__get_xml_factory(sub_elem, item, parent_element)
            i = i + 1

    @staticmethod
    def _parse_xml(t):
        d = {t.tag: {} if t.attrib else None}
        children = list(t)
        if children:
            dd = defaultdict(list)
            for dc in map(Client._parse_xml, children):
                for k, v in dc.items():
                    dd[k].append(v)
            d = {t.tag: {k: v[0] if len(v) == 1 else v for k, v in dd.items()}}

        if t.attrib:
            d[t.tag].update(('@' + k, v) for k, v in t.attrib.items())

        if t.text:
            text = t.text.strip()
            if children or t.attrib:
                if text:
                    d[t.tag]['#text'] = text
            else:
                d[t.tag] = text
        return d

    @staticmethod
    def parse_xml(body, response=None):
        """
        Parse body into the response, and put the resposne into a object
        @param body: source content
        @param response: target model
        @return the final object
        """
        return Client._parse_xml(ElementTree.fromstring(body))

    @staticmethod
    def to_xml(body):
        """
        Parse body as a xml string
        @param body: source body
        @return the xml string
        """
        if body is None:
            return

        dic = {}
        if isinstance(body, TeaModel):
            dic = body.to_map()
        elif isinstance(body, dict):
            dic = body

        if dic.__len__() == 0:
            return ""
        else:
            result_xml = '<?xml version="1.0" encoding="utf-8"?>'
            for k in dic:
                elem = ElementTree.Element(k)
                Client.__get_xml_factory(elem, dic[k])
                result_xml += bytes.decode(ElementTree.tostring(elem), encoding="utf-8")
            return result_xml
