import warnings
import functools


def deprecated(reason):
    """This is a decorator which can be used to mark functions as deprecated.
    It will result in a warning being emitted when the function is used.

    Args:
        reason (str): Explanation of why the function is deprecated.
    """

    def decorator(func):
        original_func = func.__func__ if isinstance(func, staticmethod) or isinstance(func, classmethod) else func

        @functools.wraps(original_func)
        def decorated_function(*args, **kwargs):
            warnings.warn(f"Call to deprecated function {original_func.__name__}. {reason}",
                          category=DeprecationWarning,
                          stacklevel=2)
            return original_func(*args, **kwargs)

        if isinstance(func, staticmethod):
            return staticmethod(decorated_function)
        elif isinstance(func, classmethod):
            return classmethod(decorated_function)
        else:
            return decorated_function

    return decorator
