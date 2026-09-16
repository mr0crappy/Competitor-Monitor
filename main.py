from app.monitor.service import MonitorService


def run(return_changes=False):
    service = MonitorService()
    changes = service.run()

    if return_changes:
        return changes

    return None


if __name__ == "__main__":
    run()