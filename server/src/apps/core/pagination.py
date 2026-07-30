"""
SmartStudent AI — Custom DRF Pagination Classes
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """
    Default pagination: 20 items per page, max 100.
    Response shape:
        {
            "count": <total>,
            "next": <url|null>,
            "previous": <url|null>,
            "total_pages": <int>,
            "current_page": <int>,
            "results": [...]
        }
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
    page_query_param = "page"

    def get_paginated_response(self, data):
        return Response(
            {
                "count": self.page.paginator.count,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "total_pages": self.page.paginator.num_pages,
                "current_page": self.page.number,
                "results": data,
            }
        )

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "properties": {
                "count": {"type": "integer", "example": 100},
                "next": {"type": "string", "nullable": True, "format": "uri"},
                "previous": {"type": "string", "nullable": True, "format": "uri"},
                "total_pages": {"type": "integer", "example": 5},
                "current_page": {"type": "integer", "example": 1},
                "results": schema,
            },
        }


class LargePagination(PageNumberPagination):
    """For admin endpoints that may need to display more items."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200
    page_query_param = "page"

    def get_paginated_response(self, data):
        return Response(
            {
                "count": self.page.paginator.count,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "total_pages": self.page.paginator.num_pages,
                "current_page": self.page.number,
                "results": data,
            }
        )


class SmallPagination(PageNumberPagination):
    """For conversation messages and citations where context matters."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50
    page_query_param = "page"

    def get_paginated_response(self, data):
        return Response(
            {
                "count": self.page.paginator.count,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "total_pages": self.page.paginator.num_pages,
                "current_page": self.page.number,
                "results": data,
            }
        )
